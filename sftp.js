"use strict";
const aws = require("@pulumi/aws");
const pulumi = require("@pulumi/pulumi");

// value taken from Date.now(), except we need a reproducible suffix
const projSuffix = "-" + (1561806534970 & 0x00FFFF).toString(16);

// Default module values
let modConfig = {
  "bucketName": "user-home" + projSuffix,
  "sftpUserList": [],
  "logGroup": "sftp" + projSuffix
};
let rsrcPulumiSftp = {};

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
  // Create S3 bucket that will be the home directory for everyone
  rsrcPulumiSftp.homeBucket = new aws.s3.Bucket("bucket", {bucket:modConfig.bucketName});

  // Create the sFTP service, itself
  rsrcPulumiSftp.sftpLoggingRole = new aws.iam.Role("sftpLoggingRole", {
    assumeRolePolicy: `{
	"Version": "2012-10-17",
	"Statement": [
		{
		"Effect": "Allow",
		"Principal": {
			"Service": "transfer.amazonaws.com"
		},
		"Action": "sts:AssumeRole"
		}
	]
}
`,
  });

  rsrcPulumiSftp.sftpLoggingRolePolicy = new aws.iam.RolePolicy("sftpLoggingRolePolicy", {
    policy: `{
	"Version": "2012-10-17",
	"Statement": [
		{
		"Sid": "AllowFullAccesstoCloudWatchLogs",
		"Effect": "Allow",
		"Action": [
			"logs:*"
		],
		"Resource": "*"
		}
	]
}
`,
    role: rsrcPulumiSftp.sftpLoggingRole.id,
  });

  rsrcPulumiSftp.sftpServer = new aws.transfer.Server("sftpServer", {
    identityProviderType: "SERVICE_MANAGED",
    loggingRole: rsrcPulumiSftp.sftpLoggingRole.arn,
    tags: {
      ENV: "dev",
      NAME: "basic sftp server",
    },
  }, {dependsOn:[rsrcPulumiSftp.homeBucket]});

  // start populating the users
  rsrcPulumiSftp.sftpAccessRole = new aws.iam.Role("sftpAccessRole", {
    assumeRolePolicy: `{
	"Version": "2012-10-17",
	"Statement": [
		{
		"Effect": "Allow",
		"Principal": {
			"Service": "transfer.amazonaws.com"
		},
		"Action": "sts:AssumeRole"
		}
	]
}
`,
  });

  rsrcPulumiSftp.sftpAccessRolePolicy = new aws.iam.RolePolicy("sftpAccessRolePolicy", {
    policy: `{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Sid": "AllowFullAccesstoS3",
			"Effect": "Allow",
			"Action": [
				"s3:*"
			],
			"Resource": "*"
		}
	]
}
`,
    role: rsrcPulumiSftp.sftpAccessRole.id,
  });

  modConfig.sftpUserList.forEach((x, i) => {
    rsrcPulumiSftp[x.name] = new aws.transfer.User(x.name, {
      serverId: rsrcPulumiSftp.sftpServer.id,
      userName: x.name,
      role: rsrcPulumiSftp.sftpAccessRole.arn,
      homeDirectory: "/" + modConfig.bucketName + "/" + x.name,
      tags: {
        NAME: x.name
      }
    }, {dependsOn:[rsrcPulumiSftp.homeBucket]});
    rsrcPulumiSftp[x.name + "key"] = new aws.transfer.SshKey(x.name + "key", {
      body: x.keyMaterial,
      serverId: rsrcPulumiSftp.sftpServer.id,
      userName: rsrcPulumiSftp[x.name].userName
    });
    rsrcPulumiSftp[x.name + "Home"] = new aws.s3.BucketObject(x.name + "Home", {
      bucket: rsrcPulumiSftp.homeBucket,
      key: x.name+"/README-"+x.name+".txt",
      source: new pulumi.asset.FileAsset("./usermsg.txt")
    });
  });
}
// ****************************************************************************
// Custom output
// ****************************************************************************
function postDeploy() {
  pulumi.all([
    rsrcPulumiSftp.sftpServer.id,
    rsrcPulumiSftp.homeBucket.id,
    rsrcPulumiSftp.sftpServer.endpoint
  ]).apply(([x, y, z]) => {
    console.log("sftp Info:", x);
    console.log("s3 bucket Info:", y);
    console.log("sftp Endpt:", z);
  });
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
module.exports.pulumiResources = rsrcPulumiSftp;
