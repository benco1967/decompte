import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import * as uuid from 'uuid/v4';

const CHARS = [];
for (let c = 0; c < 36; c++) {
  CHARS.push(c.toString(36));
}
const CODE_LENGTH = 4;

const client = new DocumentClient();

export const createCode = async (event, context, cb) => {
  try {
    console.log(`Requête ${JSON.stringify(event.body, null, 2)}`);
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

export const createUser = async (event, context, cb) => {
  try {
    console.log(`Requête ${JSON.stringify(event.body, null, 2)}`);
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

export const addScore = async (event, context, cb) => {
  try {
    console.log(`Requête ${JSON.stringify(event.body, null, 2)}`);
    const { code, pseudo } = JSON.parse(event.body);

    const codeResult = await client
      .get({
        TableName: 'codes',
        Key: { code },
      })
      .promise();
    if (!codeResult.Item) {
      throw new Error("ce code n'est pas disponible");
    }

    const { closingAt, available, points } = codeResult.Item;

    if (new Date(closingAt) < new Date()) {
      throw new Error('trop tard');
    }

    if (available <= 0) {
      throw new Error("il n'y a plus de points à distribuer");
    }

    await client
      .update({
        TableName: 'codes',
        Key: { code },
        UpdateExpression: 'SET available = available + :val',
        ExpressionAttributeValues: {
          ':val': -1,
        },
      })
      .promise();

    const Item = {
      id: uuid(),
      pseudo,
      code,
      points,
      createdAt: new Date().getTime(),
    };

    await client
      .put({
        TableName: 'scoresStats',
        Item,
      })
      .promise();

    const result = {
      points,
      pseudo,
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
    console.log(`Requête ${JSON.stringify(event.body, null, 2)}`);
    const { minTmp, maxTmp } = event.pathParameters;
    const minDate = new Date(minTmp).getTime();
    const maxDate = new Date(maxTmp).getTime();

    const data = await client
      .get({
        TableName: 'scoresStats',
        KeyConditionExpression: 'createdAt > :minDate and createdAt < :maxDate',
        ExpressionAttributeValues: {
          ':minDate': minDate,
          ':maxDate': maxDate,
        },
      })
      .promise();

    if (!data.Items || data.Items.length === 0) {
      throw new Error('pas de données');
    }

    const result = '';
    cb(null, {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data.Items),
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
