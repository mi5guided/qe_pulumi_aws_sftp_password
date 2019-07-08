var theJsonBody = `{
  "title": "UserUserConfig",
  "type": "object",
  "properties": {
    "HomeDirectory": {
      "type": "string"
    },
    "Role": {
      "type": "string"
    },
    "Policy": {
      "type": "string"
    },
    "PublicKeys": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  }
}`

exports.handler = async (event) => {
  return sendRes(200, theJsonBody);
};

const sendRes = (status, body) => {
  var response = {
    statusCode: status,
    headers: {
      "Content-Type": "application/json"
    },
    body: body
  };
  return response;
};

