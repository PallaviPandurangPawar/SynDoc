const documentService = require('../services/documentService');

// A plain HTML confirmation page — this is opened directly from an email
// link in the owner's browser, so it doesn't go through the React frontend.
const renderPage = (title, message, color) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>SyncDoc</title></head>
<body style="font-family: Arial, sans-serif; background:#12131b; color:#f1f5f9; display:flex; align-items:center; justify-content:center; height:100vh; margin:0;">
  <div style="max-width:420px; text-align:center; padding:32px; border:1px solid #ff9348; border-radius:14px; background:#1a1b26;">
    <h2 style="color:${color}; margin-top:0;">${title}</h2>
    <p style="color:#cbd5e1;">${message}</p>
  </div>
</body>
</html>`;

// GET /api/room-action/approve/:token — no login required
const approveByToken = async (req, res) => {
  const { token } = req.params;
  const result = await documentService.approveByToken(token);

  if (result.status === 'not_found') {
    return res.status(200).send(renderPage('Link already used', 'This request has already been handled, or the link is invalid.', '#fbbf24'));
  }

  return res.status(200).send(renderPage(
    'Request approved ✅',
    `${result.requesterName} now has access to "${result.documentTitle}".`,
    '#34d399'
  ));
};

// GET /api/room-action/reject/:token — no login required
const rejectByToken = async (req, res) => {
  const { token } = req.params;
  const result = await documentService.rejectByToken(token);

  if (result.status === 'not_found') {
    return res.status(200).send(renderPage('Link already used', 'This request has already been handled, or the link is invalid.', '#fbbf24'));
  }

  return res.status(200).send(renderPage(
    'Request denied',
    `${result.requesterName}'s request to join "${result.documentTitle}" was denied.`,
    '#f87171'
  ));
};

module.exports = { approveByToken, rejectByToken };