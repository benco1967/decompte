import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import * as uuid from 'uuid/v4';

const CHARS = [];
for (let c = 0; c < 36; c++) {
  CHARS.push(c.toString(36));
}
const CODE_LENGTH = 4;

const client = new DocumentClient();
/**
 *
 * @param event
 * @param context-
 * @param cb
 * @returns {Promise<void>}
 */
export const createCode = async (event, context, cb) => {
  try {
    console.log(`Requête ${event.body}`);
    const { points, label, nbPlayers, nbDays } = { nbDays: 1, nbPlayers: 1, ...JSON.parse(event.body) };

    let code = '';
    // création du code
    while (code === '') {
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
      const result = await client
        .get({
          TableName: 'codes',
          Key: { code },
        })
        .promise();
      if (result.Item) {
        code = '';
      }
    }

    // Création enregistrement
    const Item = {
      code,
      points,
      label,
      nbPlayers,
      available: nbPlayers,
      createdAt: new Date().getTime(),
      closingAt: new Date().getTime() + nbDays * (24 * 60 * 60 * 1000),
    };

    await client
      .put({
        TableName: 'codes',
        Item,
      })
      .promise();

    const result = {
      code,
      points,
      label,
      nbPlayers,
    };
    console.log(`Nouveau code ${JSON.stringify(result, null, 2)}`);
    cb(null, {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    });
  } catch (e) {
    console.error(e);
    cb(null, {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: e.message }),
    });
  }
};
/**
 *
 * @param event
 * @param context
 * @param cb
 * @returns {Promise<void>}
 */
export const createUser = async (event, context, cb) => {
  try {
    console.log(`Requête ${event.body}`);
    const { pseudo } = JSON.parse(event.body);

    const prev = await client
      .get({
        TableName: 'users',
        Key: {
          pseudo,
        },
      })
      .promise();

    if (prev.Item) {
      throw new Error('already existing pseudo');
    }

    // Création enregistrement
    const Item = {
      pseudo,
      createdAt: new Date().toISOString(),
    };

    await client
      .put({
        TableName: 'users',
        Item,
      })
      .promise();

    const result = {
      pseudo,
    };
    console.log(`Nouveau user ${JSON.stringify(result, null, 2)}`);
    cb(null, {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    });
  } catch (e) {
    console.error(e);
    cb(null, {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: e.message }),
    });
  }
};

export const getUsers = async (event, context, cb) => {
  try {
    const result = await client
      .scan({
        TableName: 'users',
      })
      .promise();

    console.log(`trouvé ${result.Items.length} users`);
    cb(null, {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result.Items),
    });
  } catch (e) {
    console.error(e);
    cb(null, {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: e.message }),
    });
  }
};
/**
 *
 * @param event
 * @param context
 * @param cb
 * @returns {Promise<void>}
 */
export const addScores = async (event, context, cb) => {
  try {
    console.log(`Requête ${event.body}`);
    const { label, points, players } = JSON.parse(event.body);
    console.log(`Requête ${event.body}`);

    const createdAt = new Date().getTime();
    let code = '';
    // création du code
    while (code === '') {
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
      const result = await client
        .get({
          TableName: 'codes',
          Key: { code },
        })
        .promise();
      if (result.Item) {
        code = '';
      }
    }

    await Promise.all(
      players.map(async pseudo => {
        const Item = {
          id: uuid(),
          pseudo,
          points,
          label,
          code,
          createdAt,
        };
        console.log(`score to save ${JSON.stringify(Item, null, 2)}`);
        await client
          .put({
            TableName: 'scores',
            Item,
          })
          .promise();
      }),
    );
    const result = {
      points,
      code,
    };
    console.log(`Nouveau score ${JSON.stringify(result, null, 2)}`);
    cb(null, {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    });
  } catch (e) {
    console.error(e);
    cb(null, {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: e.message }),
    });
  }
};

export const exportCSV = async (event, context, cb) => {
  try {
    const { minDate: minTmp, maxDate: maxTmp } = event.pathParameters;
    const minDate = new Date(minTmp).getTime();
    const maxDate = new Date(maxTmp).getTime() + 24 * 60 * 60 * 1000;
    console.log(`Min ${minDate} => ${minTmp} : Max ${maxDate} => ${maxTmp}`);

    const data = await client
      .scan({
        TableName: 'scores',
        FilterExpression: 'createdAt > :minDate and createdAt < :maxDate',
        ExpressionAttributeValues: {
          ':minDate': minDate,
          ':maxDate': maxDate,
        },
      })
      .promise();

    if (!data.Items || data.Items.length === 0) {
      throw new Error('pas de données');
    }

    const events = data.Items.reduce((r, item) => {
      r[item.code] = { date: item.createdAt, code: item.code, label: item.label };
      return r;
    }, {});
    const orderedEvents = Object.getOwnPropertyNames(events).sort((a, b) => events[a].date - events[b].date);
    orderedEvents.forEach((code, i) => {
      events[code].order = i;
    });

    const scoresByUser = data.Items.reduce((r, item) => {
      if (!r[item.pseudo]) {
        const tmp = new Array(orderedEvents.length);
        tmp.fill(0);
        r[item.pseudo] = tmp;
      }

      const order = events[item.code].order;
      r[item.pseudo][order] = (r[item.pseudo][order] || 0) + item.points;
      return r;
    }, {});

    let result = '';
    orderedEvents.forEach(code => {
      const event = events[code];
      console.log(JSON.stringify(event, null, 2));
      result += `;${event.label} (${new Date(event.date).toLocaleDateString()})`;
    });
    result += '\n';
    for (let pseudo in scoresByUser) {
      result += pseudo;
      scoresByUser[pseudo].forEach(score => (result += ';' + score));
      result += '\n';
    }
    cb(null, {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'text/csv',
      },
      body: result,
    });
  } catch (e) {
    console.error(e);
    cb(null, {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: e.message }),
    });
  }
};
