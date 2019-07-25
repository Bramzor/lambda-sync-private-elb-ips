
const REGION = process.env.AWS_REGION
const EVENT_NAME = '' // SET NAME OF EVENT
const DNS_RECORD_NAME = '' // SET DNS RECORD NAME YOU WANT TO UPDATE
const HOSTED_ZONE_ID = '' // SET ROUTE53 ZONE ID HOSTING THE RECORD YOU WANT TO UPDATE

const AWS = require('aws-sdk');
AWS.config.region = REGION;
const events = new AWS.CloudWatchEvents();
const route53 = new AWS.Route53();

function updateTargetInput(target, newData) {
  const Input = JSON.stringify(newData)
  const params = {
    Rule: EVENT_NAME,
    Targets: [
      {
        Arn: target.Arn,
        Id: target.Id,
        Input
      }
    ]
  };
  console.log('Updating input parameters to: ' + JSON.stringify(params))
  return events.putTargets(params).promise();
}

function updateIteration(data) {
  return events.listTargetsByRule({Rule: EVENT_NAME}).promise().then(({Targets}) => {
    if (Targets.length > 1) console.warn('More than one Target found?: ' + JSON.stringify(Targets))
    return Targets[0]
  }).then(target => updateTargetInput(target, data))
}

function updateRoute53(newips) {
  console.log('Updating Route53 A record ' + DNS_RECORD_NAME + ' with newips: ' + newips)
  var newRecord = {
    HostedZoneId: HOSTED_ZONE_ID,
    ChangeBatch: {
      Changes: [{
        Action: 'UPSERT',
        ResourceRecordSet: {
          Name: DNS_RECORD_NAME,
          Type: 'A',
          ResourceRecords: newips.map(x => { return { Value: x } }),
          TTL: 31,
        }
      }]
    }
  }
  return route53.changeResourceRecordSets(newRecord).promise();
}

exports.handler = (event, context) => {
  let newips = false
  console.log('Received event with parameters:', JSON.stringify(event, null, 2));
  if (!event.lastknownips || event.lastknownips.length < 2) throw new Error('lastknownips from event')
  var ec2 = new AWS.EC2();
  let result
  ec2.describeNetworkInterfaces((err, data) => {
    if (err) {
      console.log(err, err.stack); // an error occurred
    } else {
      if (!data.NetworkInterfaces) {
        console.error('No networkinterfaces returned')
        return false
      }
      let interfaces = data.NetworkInterfaces.filter(x => {
        return x.RequesterId === 'amazon-elb'
      })
      if (interfaces.length < 1) {
        console.error('no amazon-elb interfaces found')
        return false
      }
      let ipobjects = interfaces.map(x => x.PrivateIpAddresses).filter(x => x)
      // console.log(ipobjects)
      let privateips = ipobjects.map(x => x.map(y => y.PrivateIpAddress)).filter(x => x)
      console.log(privateips)
      let flatten = Array.prototype.concat.apply([], privateips)
      result = flatten.sort()
      if (result.toString() !== event.lastknownips.sort().toString()) {
        newips = true
      } else {
        console.log('Previous IPs: ' + event.lastknownips.sort().toString() + ', new IPs: ' + result.toString())
      }
    }

    if (!result || !newips) {
      context.done(null, 'No IP updates required');
      return
    }

    updateRoute53(result)
      .then(() => {
        console.log('Route53 updated!')
      })
      .then(() => updateIteration({ "lastknownips": result, "lastupdated": new Date(Date.now()) }))
      .then(() => {
        context.done(null, 'Function Finished with result: ' + result.join(','));  
      })
      .catch((err) => {
        console.log('Error occurred: ' + err.message)
        context.done(null, 'Function Finished with result: ' + result.join(','));  
      })
  })
};