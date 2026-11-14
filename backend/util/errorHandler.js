export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let status = err.statusCode ?? err.status ?? 500;
  let message = err.message || "Erreur interne du serveur.";

  if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors)
      .map((erreur) => erreur.message)
      .join(" ");
  } else if (err.name === "CastError") {
    status = 400;
    message = "Une valeur fournie est invalide.";
  } else if (err.code === 11000) {
    status = 409;
    message = "Une donnée unique existe déjà.";
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Le corps JSON est invalide.";
  }

  if (!Number.isInteger(status) || status < 400 || status > 599) {
    status = 500;
  }

  if (status >= 500) {
    console.error(err);
    message = "Erreur interne du serveur.";
  }

  res.status(status).json({ message });
}