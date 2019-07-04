"use strict";
const aws = require("@pulumi/aws");
const pulumi = require("@pulumi/pulumi");

// Default module values
let modConfig = {
  "requestTemplate": {},
};
let rsrcPulumiSimpleApi = {};

// ****************************************************************************
// Configure module
// ****************************************************************************
function setModuleConfig(parm) {
  let valList = Object.keys(parm);
  valList.forEach((x) => {
    modConfig[x] = parm[x];
  });

  // **** NEED TO FIX THIS GARBAGE
  // modConfig.requestTemplate["username"] = `"$input.params('Username')"`;
  // modConfig.requestTemplate["password"] = `"$input.params('Password')"`;
  // modConfig.requestTemplate["serverId"] = `"$input.params('ServerId')"`;
}

// ****************************************************************************
// Create resources
// ****************************************************************************
function rsrcPulumiCreate() {
  // Create the API Gateway Rest API
  rsrcPulumiSimpleApi.apiRestApi = new aws.apigateway.RestApi(modConfig.prefix + "sFTPAuthAPI", {
    // body: rsrcPulumiUserPool.lambda.arn.apply(lambdaArn => swaggerSpec(lambdaArn)),
    name: modConfig.prefix + "sFTPAuthAPI",
    description: "sFTP Transfer Service Custom IDP api",
    endpointConfiguration: { types: "REGIONAL" }
  });

  rsrcPulumiSimpleApi.apiLogin = new aws.apigateway.Resource(modConfig.prefix + "sFTPAuthAPILogin", {
    parentId: rsrcPulumiSimpleApi.apiRestApi.rootResourceId,
    pathPart: "login",
    restApi: rsrcPulumiSimpleApi.apiRestApi.id,
  });

  rsrcPulumiSimpleApi.apiMethod = new aws.apigateway.Method(modConfig.prefix + "sFTPAuthAPIMethod", {
    apiKeyRequired: false,
    authorization: "AWS_IAM",
    httpMethod: "GET",
    requestModels: { "application/json": modConfig.prefix + "sFTPAuthAPIModel" },
    resourceId: rsrcPulumiSimpleApi.apiLogin.id,
    restApi: rsrcPulumiSimpleApi.apiRestApi.id,
  }), { dependsOn: [rsrcPulumiSimpleApi.apiModel] };

  rsrcPulumiSimpleApi.apiModel = new aws.apigateway.Model(modConfig.prefix + "sFTPAuthAPIModel", {
    contentType: "application/json",
    description: "a JSON schema",
    restApi: rsrcPulumiSimpleApi.apiRestApi.id,
    name: modConfig.prefix + "sFTPAuthAPIModel",
    schema: `{
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
  });

  rsrcPulumiSimpleApi.apiRestItegration = new aws.apigateway.Integration(modConfig.prefix + "sFTPAuthAPIIntegration", {
    httpMethod: rsrcPulumiSimpleApi.apiMethod.httpMethod,
    integrationHttpMethod: "POST",
    resourceId: rsrcPulumiSimpleApi.apiLogin.id,
    restApi: rsrcPulumiSimpleApi.apiRestApi.id,
    type: "AWS",
    passthroughBehavior: "WHEN_NO_MATCH",
    requestTemplates: modConfig.requestTemplate,
    uri: pulumi.interpolate`arn:aws:apigateway:us-east-2:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-2:416768527988:function:simpleFunc/invocations`,
  });

  rsrcPulumiSimpleApi.apiIntegrationResponse = new aws.apigateway.IntegrationResponse(modConfig.prefix + "sFTPAuthAPIIntegrationResponse", {
    httpMethod: rsrcPulumiSimpleApi.apiMethod.httpMethod,
    resourceId: rsrcPulumiSimpleApi.apiLogin.id,
    restApi: rsrcPulumiSimpleApi.apiRestApi.id,
    statusCode: "200"
  }, { dependsOn: [rsrcPulumiSimpleApi.apiMethod] });
}

// ****************************************************************************
// Custom output
// ****************************************************************************
function postDeploy() {
  // pulumi.all([
  //   rsrcPulumiUserPool.sftpServer.id,
  //   rsrcPulumiUserPool.homeBucket.id,
  //   rsrcPulumiUserPool.sftpServer.endpoint
  // ]).apply(([x, y, z]) => {
  //   console.log("sftp Info:", x);
  //   console.log("s3 bucket Info:", y);
  //   console.log("sftp Endpt:", z);
  // });
}

// ****************************************************************************
// API into this module
// ****************************************************************************
function ddStart(params) {
  setModuleConfig(params);
  rsrcPulumiCreate();
  postDeploy();
}

module.exports.ddStart = ddStart;
module.exports.pulumiResources = rsrcPulumiSimpleApi;
