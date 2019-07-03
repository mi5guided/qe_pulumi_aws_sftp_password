"use strict";
const aws = require("@pulumi/aws");
const pulumi = require("@pulumi/pulumi");
const sftp = require("./sftp");

// Default module values
let modConfig = {
  "sftpUserList": [],
  "prefix": "dflt"
};
let rsrcPulumiUserPoolFunc = {};

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
    // if we are going to use Secrets Manager as the custom IDP create each user's entry
    if (modConfig.useCustomUserPool) {
    modConfig.sftpUserList.forEach((x, i) => {
      rsrcPulumiUserPoolFunc[x.name + "_sm"] = new aws.secretsmanager.Secret(x.name + "_sm", {
        name: "SFTP/" + x.name,
      });

      rsrcPulumiUserPoolFunc[x.name + "_smversion"] = new aws.secretsmanager.SecretVersion(x.name + "_smversion", {
        secretId: rsrcPulumiUserPoolFunc[x.name + "_sm"].id,
        secretString: JSON.stringify({
          Username: x.name,
          Password: x.pw,
          Role: sftp.pulumiResources.sftpAccessRole,
          HomeDirectory: "/" + modConfig.bucketName + "/" + x.name
        })
      });
    });
  }

  // create the Lambda Function to authorize request from AWS Secrets Manager
  rsrcPulumiUserPoolFunc.lambdaRole = new aws.iam.Role(modConfig.prefix + "LambdaRole", {
    name: modConfig.prefix + "LambdaRole",
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" }),
  });

  rsrcPulumiUserPoolFunc.lambdaRolePolicy = new aws.iam.RolePolicy(modConfig.prefix + "LambdaRolePolicy", {
    role: rsrcPulumiUserPoolFunc.lambdaRole.id,
    policy: pulumi.output({
      Version: "2012-10-17",
      Statement: [{
        Action: ["logs:*", "cloudwatch:*", "secretsmanager:GetSecretValue"],
        Resource: "*",
        Effect: "Allow",
      }],
    }),
  });

  rsrcPulumiUserPoolFunc.lambda = new aws.lambda.Function(modConfig.prefix + "LambdaFunc", {
    runtime: aws.lambda.Python3d7Runtime,
    name: modConfig.prefix + "LambdaFunc",
    code: new pulumi.asset.AssetArchive({
      ".": new pulumi.asset.FileArchive("./lambdacode.zip"),
    }),
    timeout: 300,
    handler: "lambdacode.lambda_handler",
    role: rsrcPulumiUserPoolFunc.lambdaRole.arn
  }, { dependsOn: [rsrcPulumiUserPoolFunc.lambdaRolePolicy] });
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
module.exports.pulumiResources = rsrcPulumiUserPoolFunc;
