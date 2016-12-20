Accounts.oauth.registerService('avans');

if(Meteor.isClient) {
  Meteor.loginWithAvans = function(options, callback) {
    var credentialRequestCompleteCallback = Accounts.oauth.credentialRequestCompleteHandler(callback);

    var config = ServiceConfiguration.configurations.findOne({service: 'avans'});
    if (!config) {
      credentialRequestCompleteCallback && credentialRequestCompleteCallback(
        new ServiceConfiguration.ConfigError());
      return;
    }

    var credentialToken = Random.secret();
    var loginStyle = OAuth._loginStyle('avans', config, options);

    OAuth.launchLogin({
        loginService: 'avans',
        loginStyle: loginStyle,
        loginUrl: '/_oauth/avans/?requestTokenAndRedirect=true&state=' + OAuth._stateParam(loginStyle, credentialToken),
        credentialRequestCompleteCallback: credentialRequestCompleteCallback,
        credentialToken: credentialToken,
        popupOptions: { height: 406 }
      });
  };
} else {
  Accounts.addAutopublishFields({
      forLoggedInUser: ['services.avans'],
      forOtherUsers: ['services.avans'],
    });

  var urls = {
    requestToken: "https://publicapi.avans.nl/oauth/request_token",
    accessToken: "https://publicapi.avans.nl/oauth/access_token",
    authenticate: "https://publicapi.avans.nl/oauth/saml.php",
  };

  OAuth.registerService('avans', 1, urls, function(oauthBinding) {
    var identity = oauthBinding.get('https://publicapi.avans.nl/oauth/people/@me').data;

    var serviceData = {
      accessToken: OAuth.sealSecret(oauthBinding.accessToken),
      accessTokenSecret: OAuth.sealSecret(oauthBinding.accessTokenSecret),
    };
    _.extend(serviceData, identity);

    return {
      serviceData: serviceData,
      options: {profile: {name: identity.nickname}}
    };
  });

  ServiceConfiguration.configurations.upsert(
    { service: "avans" },
    {
      $set: {
        consumerKey: "90cc4fbf7ebb50e84b1f9e1189c7e8f4c48cda2b",
        secret: "94ad62cc15a4debeff7865a5520a54b72087eaab"
      }
    }
  );
}
