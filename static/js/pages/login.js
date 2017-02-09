$(document).ready(function() {
  $("#login_form").submit(function(e) {
    e.preventDefault();

    $("#login_button").hide();
    $("#login_spinner").show();
    $("#login_spinner").css("display", "block");

    $.getJSON("/login/challenge?username=" + $("#login-username").val(), function(data) {
      sm.crypto.importKeys(null, data.key, $("#login-password").val(), function(err, pub, priv) {
        if (err) {
          $("#login_spinner").hide();
          $("#login_button").show();
          return alert(err.message);
        }

        sm.crypto.rsaDecrypt(priv, data.challenge, function(err, dec) {
          $("#response_token").val(dec);
          $("#response_user").val(data.user);

          $("#response_form").submit();
        });
      });
    });
  })
})
