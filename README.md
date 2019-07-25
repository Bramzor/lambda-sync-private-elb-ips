# AWS Lambda example to check if ELB private IPS are changed

Based on NodeJS

## Summary

This Lambda function allows you to use an AWS ELB (application loadbalancer) that is configured as a public loadbalancer to also balance private loads by keeping the private IPS up to date in a Route53 record.
Run this lambda function every x minutes to check if the IPs of the loadbalancers changed (by checking network interfaces). It updates the event parameters to save the last status and when IPs changed, it will update the specified Route53 record.

## Deploy

To use this plugin:

* set parameters at the top of index.js file
* Clone this repo: git clone 
* npm install
* run `npm run createzip` to create a zipfile with all content to upload to Lambda
* create a function on AWS for Lambda and update the zip file
* create an event that runs the lambda function every x minutes (make sure the name of the event matches the parameter in index.js)

**Notice**: The first times it will run slow and take about 3seconds to complete. This drops to 300ms after a few executions.

## IAM Setting

Besides the normal Lambda policy to write to CloudWatch logs, you also need the following policy:
(Replace _ACCOUNTID_ with your accountid, _ZONEID_ with the route53 zone and _FUNCTIONNAME_ with the name of the lambda function)

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": "ec2:DescribeNetworkInterfaces",
            "Resource": "*"
        },
        {
            "Sid": "VisualEditor1",
            "Effect": "Allow",
            "Action": [
                "events:PutTargets",
                "route53:ChangeResourceRecordSets",
                "events:ListTargetsByRule"
            ],
            "Resource": [
                "arn:aws:events:*:_ACCOUNTID_:rule/_FUNCTIONNAME_",
                "arn:aws:route53:::hostedzone/_ZONEID_"
            ]
        }
    ]
}
```