const tls = require("tls"),
  fs = require("fs"),
  dns = require("dns"),
  util = require("./../lib/util.js"),
  config = require("./../config.json")

const IncomingEmail = require("./IncomingEmail.js");

const AcceptedCommands = [
  "EHLO",
  "HELO",
//  "STARTTLS",
  "MAIL",
  "RCPT",
  "DATA",
  "RSET",
  "NOOP",
  "QUIT"
]

class SMTPConnection {

  constructor(socket, server) {
    this._socket = socket;
    this._server = server;

    this.status = 1;

    socket.on("data", (data) => {
      this.dataHandler(data)
    });

    this.welcome();
  }

  response(code, data) {
    this._socket.write(code.toString() + " " + data + "\r\n")
  }

  write(data) {
    this._socket.write(data);
  }

  writeLine(data) {
    this._socket.write(data + "\r\n");
  }

  dataHandler(data) {
    if (this.status == 1) {
      this.command(data.toString());
    } else if (this.status == 2) {
      if (!this.email.parser.pipe(data.toString())) {
        this.status = 1;

        this.email.process((err) => {
          if (err) {
            this.response(501, "Syntax error in parameters or arguments")
          } else {
            this.ok()
          }
        })
      }
    }
  }

  ok() {
    this.response(250, "OK");
  }

  command(data) {

    let commandData = data.split(" ")
    let cmd = commandData[0].trim().toUpperCase();


    if (AcceptedCommands.indexOf(cmd) != -1) {
      commandData.splice(0, 1);
      this["cmd_" + cmd](commandData);

    } else {
      this.response(502, "Command not implemented")
    }
  }

  cmd_EHLO(params) {
    if (params.length > 0) {
      let reverseIP = this._socket.remoteAddress.split(".").reverse().join(".")

      dns.resolve(reverseIP + "." + config.DNSBLServer, "A", (err) => {
        if (err) {
          this.writeLine("250-SIZE 100000");
          //this.writeLine("250-STARTTLS");
          this.writeLine("250-HELP");
          this.response(250, config.domain + " ready");

          this.domain = params[0];
        } else {
          this.response(501, "Your IP is listed as a potential spammer, closing connection")
        }
      });

    } else {
      this.response(501, "Invalid domain specified, closing connection");
      this._socket.destroy()
    }
  }

  cmd_STARTTLS(params) {
    this.response(220, "ready to start TLS");

    let secureContext = this._server.secureContext.get("default");
    let tlsSocket = new tls.TLSSocket(this._socket, {
      cert: secureContext.cert,
      key: secureContext.key,
      isServer: true,
      server: this._server.server,

      SNICallback: function(servername, cb) {
      }
    })

    this._socket.removeAllListeners();

    tlsSocket.on("secureConnection", () => {
      this.secure = true;

      tlsSocket.on("data", (data) => {
        this.dataHandler(data);
      });

      this._socket = tlsSocket;
    })
  }

  cmd_MAIL(params) {

    if (!this.domain) {
      return this.response(503, "Be polite, say EHLO first!")
    }

    if (!params[0]) {
      return this.response(501, "Invalid from parameters")
    }

    let paramSplit = params[0].split(":")

    if (paramSplit.length < 2) {
      this.response(501, "Invalid from parameters")
    } else {

      let addr = util.processAddress(paramSplit[1].trim())
      if (addr.address) {
        this.email = new IncomingEmail()
        this.email.setSender(addr)

        this.ok()
      } else {
        this.response(501, "Invalid from parameters")
      }
    }
  }

  cmd_RCPT(params) {
    if (!this.email) {
      return this.response(503, "Use MAIL command first")
    }

    let paramSplit = params[0].split(":")

    if (paramSplit.length < 2) {
      this.response(501, "Invalid to parameters")
    } else {
      this.email.addRecipient(paramSplit[1].trim(), (err) => {
        if (err) {
          this.response(550, "The user account specified does not exist")
        } else {
          this.ok()
        }
      })
    }
  }

  cmd_DATA(params) {
    if (this.email && this.email.recipients.length > 0) {
      this.status = 2
      this.response(354, "Start mail input; end with <CRLF>.<CRLF>")
    } else {
      this.response(503, "Use MAIL & RCPT first")
    }
  }

  cmd_RSET() {
    this.email = null;
    this.response(250, "Flushed")
  }

  cmd_NOOP() {
    this.ok()
  }

  cmd_QUIT() {
    this.response(221, config.domain + " closing transmission channel - bye!")
    this._socket.destroy();
  }

  welcome() {
    this.response(220, "smtp.securemail.com ESMTP securemail v1.0")
  }
}

module.exports = SMTPConnection
