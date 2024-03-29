function createInboxElement(email) {
  // TODO: XSS PREVENTION
  email.date = new Date(email.date * 1000);

  email.subject = sm.mime.parseSubject(email.subject)

  if (!email.name || email.name.trim() == "") {
    email.name = email.email
  }

  email.name = sm.mime.parseSubject(email.name)

  var html = "<li>"
    + "<a href='#' id='email-" + email.id + "' class='sm-email" + (email.marked_read == 0 && " sm-unread" || "") + "' data-id='" + email.id + "'>"
      + "<div class='sm-left'>"
        + "<span class='sm-subject'>" + email.subject + "</span>"
        + "<span class='sm-from'>" + email.name + "</span>"
      + "</div>"
      + "<span class='sm-date'>" + sm.inbox.formatDate(email.date) + "</span>"
    + "</a></li>";

  $(".sm-emails").append(html);
  $(".sm-emails h3").hide();

  updateEmailActions(email.id);
}

function updateEmailActions(id) {
  $("#email-" + id).click(function(e) {
    e.preventDefault();
    $(".sm-active").removeClass("sm-active");
    $(this).addClass("sm-active");
    $(this).removeClass("sm-unread");

    var id = $(this).data("id");

    sm.inbox.retrieve(id, function(err, email, message, tags) {
      sm.inbox.updateView(email, message, tags);
      sm.inbox.openView();
    });
  })
}

function updateEmails(clear, search) {
  if (clear) {
    if (!search)
      sm.inbox.search = ""

    sm.inbox.index = 0
    $(".sm-emails li").remove()
  }

  sm.inbox.load(function(err, emails, count) {
    $("#sm-unread-count").text(count);
    document.title = "("+ count + ") Inbox | SecureMail"

    for (var i=0; i<emails.length; i++) {
      createInboxElement(emails[i]);
    }
  })
}

$(document).ready(function() {
  sm.inbox.init(function() {
    $(".sm-content-loader").fadeOut(function() {
      $(".sm-main").fadeIn();
    });
  });

  updateEmails(true)

  $("#password-prompt-form").submit(function(e) {
    e.preventDefault();
    var password = $("#password-prompt").val();

    sm.inbox.promptSubmit(password);
  })

  $(".sm-email-view").click(function() {
    sm.inbox.extendView();
  })

  $(".sm-list-overlay").click(function() {
    sm.inbox.shrinkView();
  })

  $("#compose-email-btn").click(function(e) {
    e.preventDefault();
    sm.inbox.compose();
  })

  $(".sm-send-container").click(function(e) {
    sm.inbox.closeCompose()
  })

  $(".sm-send").click(function(e) {
    e.stopPropagation()
  })

  $("#send-submit").click(function(e) {
    e.preventDefault()
    sm.inbox.send($("#send-to").val(), $("#send-subject").val(), $("#send-body").val())
  })

  $("#sm-page-sent").click(function(e) {
    e.preventDefault()
    sm.inbox.search = ""
    $("#search-input").val(sm.inbox.search)
    sm.inbox.index = 0
    sm.inbox.type = 2
    updateEmails(true)
  })

  $("#sm-page-inbox").click(function(e) {
    e.preventDefault()
    sm.inbox.search = ""
    $("#search-input").val(sm.inbox.search)
    sm.inbox.index = 0
    sm.inbox.type = 1
    updateEmails(true)
  })

  $("#load-more-btn").click(function(e) {
    e.preventDefault()
    updateEmails()
  })

  $("#search-form").submit(function(e) {
    e.preventDefault()
    sm.inbox.search = $("#search-input").val()
    sm.inbox.index = 0
    updateEmails(true, true)
  })

  $("#email-reply").click(function(e) {
    e.preventDefault()
    e.stopPropagation()
    sm.inbox.compose(sm.inbox.currentMessage.email, "Re: " + sm.inbox.currentMessage.subject, "")
  })

  $("#email-delete").click(function(e) {
    e.preventDefault()
    e.stopPropagation()

    var res = confirm("Are you sure you want to delete this message?")

    if (res) {
      sm.inbox.delete(sm.inbox.currentMessage.id)
    }

  })

  $("#email-tag").click(function(e) {
    e.preventDefault()
    e.stopPropagation()

    if ($(".sm-email-tags").is(":visible")) {
      $(".sm-email-tags").hide()
    } else {
      $(".sm-email-tags").show()
    }
  })

  $("#new-tag-form").submit(function(e) {
    e.preventDefault();
    var tag = $("#new-tag").val()

    sm.inbox.createTag(tag, function(err) {
      if (err) {
        alert(err.message)
      } else {
        sm.inbox.updateTags()
        $("#new-tag").val("")
      }
    });
  })

  $(".sm-email-tags").click(function(e) {
    e.stopPropagation()
  })

  $("#sm-page-spam").click(function(e) {
    e.preventDefault()
    sm.inbox.search = "tag:spam"
    $("#search-input").val(sm.inbox.search)
    sm.inbox.index = 0
    updateEmails(true, true)
  })

  $("#email-mark-spam").click(function(e) {
    e.preventDefault()
    sm.inbox.markSpam(sm.inbox.currentMessage.id)
  })
})
setInterval(function() {
  $("#email-view-content-html").css("height", $(".sm-email-view").height() - $(".sm-email-header").height() + "px")
  $("#email-view-content-text").css("height", $(".sm-email-view").height() - $(".sm-email-header").height() + "px")
  $(".sm-email-list").css("height", window.innerHeight - 90 + "px")
  $(".sm-email-view-container").css("height", window.innerHeight - 90 + "px")
}, 100)
