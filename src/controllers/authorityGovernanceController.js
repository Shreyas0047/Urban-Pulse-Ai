const { buildAuthorityGovernance } = require("../services/authoritySlaService");
const BENGALURU = require("../config/bengaluru");

async function getAuthorityGovernance(req, res, next) {
  try {
    const governance = await buildAuthorityGovernance();
    res.json({ authorityGovernance: governance });
  } catch (error) {
    next(error);
  }
}

async function evaluateAuthorityGovernance(req, res, next) {
  try {
    const governance = await buildAuthorityGovernance();
    res.json({
      message: `${BENGALURU.name} authority SLA evaluation completed.`,
      authorityGovernance: governance
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { evaluateAuthorityGovernance, getAuthorityGovernance };
