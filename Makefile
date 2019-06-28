
up: 
	pulumi up

down: 
	pulumi destroy

out:
	pulumi stack output

preview:
	time node preTest.js

access-test:
	aws --profile pulumitargetacct s3 ls
