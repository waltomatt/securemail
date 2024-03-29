sm.inbox = {}
sm.inbox.index = 0;
sm.inbox.type = 1;
sm.inbox.search = ""

sm.inbox.keys = {};
sm.inbox.tags = {};

sm.inbox.init = function(cb) {

  var password = sessionStorage.getItem("sm_password");
  if (!password) {
    return sm.inbox.prompt(function() {
      sm.inbox.init(cb);
    })
  }

  $(".sm-content-loader").fadeIn();

  $.getJSON("/inbox/getKeys", function(data) {
    sm.crypto.importKeys(data.publicKey, data.privateKey, password, function(err, publicKey, privateKey) {
      if (err) {
        return sm.inbox.prompt(function() {
          sm.inbox.init(cb);
        })
      } else {
        sm.inbox.keys.public = publicKey;
        sm.inbox.keys.private = privateKey;
        cb();
      }
    });
  });

  sm.inbox.updateTags()
}

sm.inbox.loaded = 0

sm.inbox.load = function(cb) {
  var loadAmount = Math.ceil((window.innerHeight / 57) * 1.7)
  $.getJSON("/inbox/list?start=" + sm.inbox.index + "&amount=" + loadAmount + "&type=" + sm.inbox.type + "&search=" + sm.inbox.search, function(data) {
    sm.inbox.loaded = sm.inbox.index + loadAmount
    sm.inbox.index += loadAmount
    cb(null, data.emails, data.unread)
  });
}

sm.inbox.retrieve = function(id, cb) {
  $.getJSON("/inbox/retrieve?id=" + id, function(data) {
    if (data.status == "success") {
      var dd = forge.util.decode64(data.data);
      sm.crypto.decrypt(sm.inbox.keys.private, data.data, data.email.encrypted_key, function(err, message) {
        cb(err, data.email, message, data.tags);
      });
    } else {
      alert("Failed to load email");
    }
  });
}

sm.inbox.currentRawMessage = ""
sm.inbox.currentMessage = {}

sm.inbox.updateView = function(email, message, tags) {
  email.date = new Date(email.date * 1000);
  sm.inbox.currentMessage = email

  $("#email-view-subject").html(sm.mime.parseSubject(email.subject));
  $("#email-view-from").html(email.email);
  $("#email-view-date").html(sm.inbox.formatDate(email.date));

  sm.inbox.currentRawMessage = message

  $(".sm-email-tags input").each(function() {
    if (tags.indexOf($(this).data("id")) > -1) {
      $(this).prop("checked", true)
    } else {
      $(this).prop("checked", false)
    }
  })

  sm.inbox.getEmailDisplays(message, function(err, displays, attachments) {
    if (displays[0]) {
      if (displays[0].type == "text/plain") {
        $("#email-view-content-html").hide()
        var body = displays[0].body.trim()
        body = body.replace(new RegExp("\n", "g"), "<br>")
        $("#email-view-content-text").html(body)
        $("#email-view-content-text").show()
      } else if (displays[0].type == "text/html") {
        $("#email-view-content-text").hide()
        $("#email-view-content-html").contents().find("html").html(displays[0].body)
        $("#email-view-content-html").css("height", $(".sm-email-view").height() - $(".sm-email-header").height() + "px")
        $("#email-view-content-html").show()

        var iframe = $("#email-view-content-html").contents();
        iframe.find("a").click(function(e) {
          e.preventDefault();
          var link = $(this).attr("href")
          var popup = window.open("about:blank", "_blank")
          popup.location = link
        })

      }
    }

    $(".sm-email-attachments a").remove()

    for (var i=0; i<attachments.length; i++) {
      var html = "<a href='data:application/octet-stream;base64," + attachments[i].data + "' target='_blank' download='" + attachments[i].filename + "'>" + attachments[i].filename + "</a>"
      $(".sm-email-attachments").append(html)
    }
  })

}

sm.inbox.viewRaw = function() {
  var rawWindow = window.open("", "message.txt", "width=1000,height=800")
  rawWindow.document.write("<textarea style='width:100%; height:100%'>" + sm.inbox.currentRawMessage + "</textarea>")
}

sm.inbox.openView = function() {
  $(".sm-email-view-container").css("padding-left", "0px");
}

sm.inbox.closeView = function() {
  $(".sm-email-view-container").css("padding-left", "550px");
}

sm.inbox.extendView = function() {
  $(".sm-email-view-container").addClass("sm-extended");
  $(".sm-list-overlay").fadeIn();
}

sm.inbox.shrinkView = function() {
  $(".sm-list-overlay").fadeOut();
  $(".sm-email-view-container").removeClass("sm-extended");
}

sm.inbox.prompt = function(cb) {
  $(".sm-main").hide();
  $(".sm-content-loader").hide();
  $(".sm-sidebar").hide();

  $(".sm-password-prompt-container").fadeIn();
  sm.inbox.promptFunction = cb;
}

sm.inbox.promptSubmit = function(password) {
  $(".sm-password-prompt-container").fadeOut(function() {
    sessionStorage.setItem("sm_password", password);
    if (sm.inbox.promptFunction) {
      $(".sm-sidebar").show()
      sm.inbox.promptFunction(password);
    }
  })
}

sm.inbox.formatDate = function(date) {
  if (date.toLocaleDateString() == (new Date()).toLocaleDateString()) {
    // check if the date is the same, if so only display hours
    return ("0" + date.getHours()).substr(-2) + ":" + ("0" + date.getMinutes()).substr(-2);
  } else {
    return ("0" + date.getDate()).substr(-2) + "/" + ("0" + date.getMonth()).substr(-2) + "/" + date.getFullYear();
  }
}

var preferredTypes = ["text/html", "text/plain"]

sm.inbox.getEmailDisplays = function(data, callback) {
  sm.mime.process(data, function(err, data) {
    var displays = []
    var attachments = []

    function recursiveSearch(obj, cb) {
      if (obj.children) {
        var i = 0;

        function go() {
          if (obj.children[i]) {
            recursiveSearch(obj.children[i], function() {
              i++;
              go();
            })
          } else {
            cb()
          }
        }

        go()

      } else {
        if (obj.headers["content-disposition"]) {
          var disposition = obj.headers["content-disposition"].split(";")

          if (disposition[0].trim().toLowerCase() == "attachment") {

            var filename = "attachment_" + (attachments.length + 1)

            if (disposition[1] && disposition[1].toLowerCase().indexOf("filename=") > -1) {
              filename = disposition[1].toLowerCase().split("filename=")[1].replace(new RegExp("\"", "g"), "")
            }

            attachments.push({
              type: obj.headers["content-type"],
              filename: filename,
              data: btoa(obj.body)
            })

            return cb()
          }
        }

        if (!obj.body || !obj.headers["content-type"]) {
          return cb();
        }

        var type = obj.headers["content-type"].split(";")[0].trim()

        if (preferredTypes.indexOf(type) == -1) {
          return cb()
        }

        displays.push({
          type: type,
          body: obj.body
        })

        cb()
      }
    }

    recursiveSearch(data, function() {
      displays.sort(function(a, b) {
        if (a.type == preferredTypes[0]) {
          return -1
        } else {
          return 1
        }
      })

      callback(null, displays, attachments)
    })
  })
}

sm.inbox.compose = function(to, subject, body) {
  to = to || ""
  subject = subject || ""
  body = body || ""

  $(".sm-send-container #send-to").val(to)
  $(".sm-send-container #send-subject").val(subject)
  $(".sm-send-container #send-body").text(body)
  $(".sm-send-container").removeClass("sm-hidden closed")
}

sm.inbox.closeCompose = function() {
  $(".sm-send-container").addClass("closed")
  setTimeout(function() {
    $(".sm-send-container").addClass("sm-hidden")
  }, 200)
}

sm.inbox.send = function(to, subject, body) {
  $.post("/inbox/send", {
    to: to,
    subject: subject,
    body: body
  }, function(res) {
    if (res.status == "success") {
      alert("Successfully sent email")
      sm.inbox.closeCompose()
    } else {
      alert("Failed to send email: " + res.error)
    }
  }, "json")
}

sm.inbox.addEmailTag = function(emailID, tagID) {
  $.post("/inbox/addEmailTag", {
    email: emailID,
    tag: tagID
  }, "json")
}

sm.inbox.removeEmailTag = function(emailID, tagID) {
  $.post("/inbox/removeEmailTag", {
    email: emailID,
    tag: tagID
  }, "json")
}

sm.inbox.updateTags = function() {
  $.getJSON("/inbox/getTags", function(res) {
    if (res.status == "success") {
      $("#tag-list li:not(.new-tag)").remove();
      $(".sm-email-tags li").remove();

      for (var i=0; i<res.tags.length; i++) {
        var html = "<li><a href='#' class='tag-link' data-id='" + res.tags[i].id + "'>" + res.tags[i].tag + "</a></li>";
        $(html).insertBefore("#tag-list .new-tag")

        html = "<li><input type='checkbox' id='email-tag-" + res.tags[i].id + "' data-id='"+ res.tags[i].id + "'><label for='email-tag-" + res.tags[i].id + "'>" + res.tags[i].tag + "</label></li>"
        $(".sm-email-tags ul").append(html);

        sm.inbox.tags[res.tags[i].id] = res.tags[i].tag
      }

      $(".sm-email-tags input").change(function() {
        if (this.checked) {
          sm.inbox.addEmailTag(sm.inbox.currentMessage.id, $(this).data("id"))
        } else {
          sm.inbox.removeEmailTag(sm.inbox.currentMessage.id, $(this).data("id"))
        }
      })

      $("#tag-list a").click(function(e) {
        e.preventDefault()
        sm.inbox.search = "tag:" + $(this).data("id")
        $("#search-input").val(sm.inbox.search)
        sm.inbox.index = 0
        updateEmails(true, true)
      })

    } else {
      alert("Error getting tags: " + res.error)
    }
  })


}

sm.inbox.createTag = function(tag, cb) {
  $.post("/inbox/createTag", {
    tag: tag
  }, function(res) {
    if (res.status == "success")
      cb()
    else
      cb(new Error(res.error))
  }, "json")
}

sm.inbox.delete = function(id) {
  $.post("/inbox/delete", {
    id: id
  }, function(res) {
    if (res.status == "success") {
      $("#email-" + id).remove()
      sm.inbox.shrinkView()
      $(".sm-email-view-container").css("padding-left", "550px")
    } else {
      alert("Failed to delete message: " + res.error)
    }
  }, "json")
}

sm.inbox.markSpam = function(id) {
  $.post("/inbox/markSpam", {
    id: id
  }, function(res) {
    if (res.status == "success") {
      $("#email-" + id).remove()
      sm.inbox.shrinkView()
      $(".sm-email-view-container").css("padding-left", "550px")
    } else {
      alert("Failed to mark message: " + res.error)
    }
  }, "json")
}
