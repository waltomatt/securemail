const User = require("./User.js"),
  log = require("./../lib/log.js"),
  util = require("./../lib/util.js"),
  spam = require("./../lib/spam.js"),
  config = require("./../config.json"),
  MessageParser = require("./MessageParser.js"),
  Email = require("./Email.js")


let idCounter = 0;

class IncomingEmail extends Email {
  constructor() {
    super()
    this.parser = new MessageParser()
    this.type = 1

  }

  addRecipient(recipient, cb) {

    recipient = util.processAddress(recipient)
    if (recipient.address) {
      let address = recipient.address.split("@")

      let username = address[0]
      let domain = address[1];

      if (domain == config.domain) {
        let user = new User()
        user.load(username, (err, exists) => {
          if (exists) {
            this.recipients.push(user);
            cb()

          } else {
            cb(new Error("user not found"));
          }
        })
      } else {
        cb(new Error("user not found"));
      }
    } else {
      cb(new Error("Invalid email address"))
    }
  }

  setSendingServer(domain, ip) {
    this.sendingServer = {
      ip: ip,
      domain: domain
    }
  }

  process(cb) {
    this.parser.extractMeta((err, meta) =>{
      if (!err) {
        this.meta = meta
        this.data = this.parser.originalMessage

        this.setSender(this.meta.from)
        this.setMessageID(this.meta.message_id)

        if (this.meta.references) {
          for (var i=0; i<this.meta.references.length; i++) {
            this.addReference(this.meta.references[i], (this.meta.references[i] == this.meta.in_reply_to))
          }
        }

        for (var i=0; i<this.recipients.length; i++) {
          let indEmail = new IncomingEmail()
          Object.assign(indEmail, this)
          indEmail.user = this.recipients[i]
          indEmail.save((err, id) => {

            spam.process(this.data, id, this.meta.from.address, indEmail.user.id)

            cb(null, id)
          });
        }

      } else {
        cb(new Error("Message is not formatted correctly"))
      }
    })
  }
}

module.exports = IncomingEmail
