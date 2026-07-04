const { verifySmtpConnection } = require("../src/services/emailService");

verifySmtpConnection()
  .then((result) => {
    console.log(
      JSON.stringify(
        {
          ok: result.ok,
          host: result.host,
          port: result.port,
          secure: result.secure,
          fromConfigured: Boolean(result.from)
        },
        null,
        2
      )
    );
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
