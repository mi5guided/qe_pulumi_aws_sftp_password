"use strict";
const aws = require("@pulumi/aws");
const pulumi = require("@pulumi/pulumi");

// Default module values
let modConfig = {
  "sftpUserList": [],
  "prefix": "dflt"
};
let rsrcPulumiUserPool = {};

// ****************************************************************************
// Configure module
// ****************************************************************************
function setModuleConfig(parm) {
  let valList = Object.keys(parm);
  valList.forEach((x) => {
    modConfig[x] = parm[x];
  });
}

// ****************************************************************************
// Create resources
// ****************************************************************************
function rsrcPulumiCreate() {
  // create each user's entry into AWS Secrets Manager
  modConfig.sftpUserList.forEach((x, i) => {
    rsrcPulumiUserPool[x.name + "_sm"] = new aws.secretsmanager.Secret(x.name + "_sm", {
      username: "SFTP/" + x.name,
      password: x.pw,
      PublicKeys: x.keyMaterial,
      role: rsrcPulumiSftp.sftpAccessRole.arn,
      homeDirectory: "/" + modConfig.bucketName + "/" + x.name
    });
  });

  // create the Lambda Function to authorize request from AWS Secrets Manager
  rsrcPulumiUserPool.lambdaRole = new aws.iam.Role(modConfig.prefix + "LambdaRole", {
    name: modConfig.prefix + "LambdaRole",
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" }),
  });

  rsrcPulumiUserPool.lambdaRolePolicy = new aws.iam.RolePolicy(modConfig.prefix + "LambdaRolePolicy", {
    role: rsrcPulumiUserPool.lambdaRole.id,
    policy: pulumi.output({
      Version: "2012-10-17",
      Statement: [{
        Action: ["logs:*", "cloudwatch:*", "secretsmanager:GetSecretValue"],
        Resource: "*",
        Effect: "Allow",
      }],
    }),
  });

  rsrcPulumiUserPool.lambda = new aws.lambda.Function(modConfig.prefix + "LambdaFunc", {
    runtime: aws.lambda.Python3d7Runtime,
    code: new pulumi.asset.AssetArchive({
      ".": new pulumi.asset.FileArchive(lambdacode.py),
    }),
    timeout: 300,
    handler: lambdacode.lambda_handler,
    role: rsrcPulumiUserPool.lambdaRole.arn
  }, { dependsOn: [policy] });

  // create API Gateway
  // Create the Swagger spec for a proxy which forwards all HTTP requests through to the Lambda function.
  function swaggerSpec(lambdaArn: string): string {
    let swaggerSpec = {
      swagger: "2.0",
      info: { title: "api", version: "1.0" },
      paths: {
        "/{proxy+}": swaggerRouteHandler(lambdaArn),
      },
    };
    return JSON.stringify(swaggerSpec);
  }

  // Create a single Swagger spec route handler for a Lambda function.
  function swaggerRouteHandler(lambdaArn: string) {
    let region = aws.config.requireRegion();
    return {
      "x-amazon-apigateway-any-method": {
        "x-amazon-apigateway-integration": {
          uri: `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${lambdaArn}/invocations`,
          passthroughBehavior: "when_no_match",
          httpMethod: "POST",
          type: "aws_proxy",
        },
      },
    };
  }

  // Create the API Gateway Rest API, using a swagger spec.
  rsrcPulumiUserPool.restApi = new aws.apigateway.RestApi(modConfig.prefix + "sFTPAuthAPI", {
    body: lambda.arn.apply(lambdaArn => swaggerSpec(lambdaArn)),
  });

  // Create a deployment of the Rest API.
  rsrcPulumiUserPool.deployment = new aws.apigateway.Deployment(modConfig.prefix + "sFTPAuthAPIDeployment", {
    restApi: restApi,
    // Note: Set to empty to avoid creating an implicit stage, we'll create it explicitly below instead.
    stageName: "",
  });

  // Create a stage, which is an addressable instance of the Rest API. Set it to point at the latest deployment.
  rsrcPulumiUserPool.stage = new aws.apigateway.Stage(modConfig.prefix + "sFTPAuthAPIStage", {
    restApi: rsrcPulumiUserPool.restApi,
    deployment: rsrcPulumiUserPool.deployment,
    stageName: stageName,
  });

  // Give permissions from API Gateway to invoke the Lambda
  rsrcPulumiUserPool.invokePermission = new aws.lambda.Permission(modConfig.prefix + "sFTPAuthAPILambdaPermission", {
    action: "lambda:invokeFunction",
    function: rsrcPulumiUserPool.lambda,
    principal: "apigateway.amazonaws.com",
    sourceArn: pulumi.interpolate`${rsrcPulumiUserPool.deployment.executionArn}*/*`,
  });
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
module.exports.pulumiResources = rsrcPulumiUserPool;
