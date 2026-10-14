/* ============================================================
   Feedback screenshots — paste into the Apps Script project
   ------------------------------------------------------------
   The app now sends `attachments` with each feedback message:
     [{ name: "screenshot.png", type: "image/png", data: "<base64>" }]
   (at most 3 images, already shrunk to 1600px by the browser).

   Until the "feedback" handler uses this, the backend ignores the
   field: messages still arrive, screenshots are dropped.

   Wire it in three places:

   1. In the "feedback" handler, before writing the row:
        var shots = saveFeedbackShots_(p.attachments, p.email);
      Add one more column to the row:
        shots.map(function (s) { return s.url; }).join("\n")
      And attach the images to the alert email:
        MailApp.sendEmail({ ..., attachments: shots.map(function (s) { return s.blob; }) });

   2. In the handler that lists feedback for the admin view
      ("feedbackList" in Coding Astra, "admin_data" in Denial Guru),
      give each item:
        attachments: String(row[<that column>] || "").split("\n")
          .filter(String).map(function (u) { return { url: u }; })

   3. Run authorizeFeedbackDrive once from the editor, then deploy a new
      version (Deploy > Manage deployments > Edit > New version).
      Files go to a private Drive folder owned by the script's
      account. Share that folder (Viewer) with whoever reads the
      admin view, so the links open for them. Never set it to
      "anyone with the link": screenshots can carry patient data.
   ============================================================ */
var FEEDBACK_FOLDER_NAME = "Feedback screenshots";
var FEEDBACK_MAX_SHOTS = 3;
var FEEDBACK_MAX_BYTES = 5 * 1024 * 1024; // per image, after decoding

function feedbackFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("FEEDBACK_FOLDER_ID");
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* deleted: make a new one */ }
  }
  var folder = DriveApp.createFolder(FEEDBACK_FOLDER_NAME);
  props.setProperty("FEEDBACK_FOLDER_ID", folder.getId());
  return folder;
}

/* Returns [{ url, blob }]. Anything that is not a PNG/JPEG/GIF/WebP
   image, or is too big, is skipped rather than failing the message. */
function saveFeedbackShots_(attachments, email) {
  if (!Array.isArray(attachments) || !attachments.length) return [];
  var ok = { "image/png": 1, "image/jpeg": 1, "image/gif": 1, "image/webp": 1 };
  var folder = feedbackFolder_();
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HHmmss");
  var who = String(email || "anon").replace(/[^\w.@-]/g, "_").slice(0, 60);
  var out = [];
  attachments.slice(0, FEEDBACK_MAX_SHOTS).forEach(function (a, i) {
    if (!a || !ok[a.type] || typeof a.data !== "string") return;
    var bytes;
    try { bytes = Utilities.base64Decode(a.data); } catch (e) { return; }
    if (!bytes.length || bytes.length > FEEDBACK_MAX_BYTES) return;
    var ext = a.type === "image/jpeg" ? ".jpg" : "." + a.type.split("/")[1];
    var blob = Utilities.newBlob(bytes, a.type, stamp + " " + who + " " + (i + 1) + ext);
    var file = folder.createFile(blob);
    out.push({ url: file.getUrl(), blob: blob });
  });
  return out;
}

/* Run once from the editor so the script is granted Drive access. */
function authorizeFeedbackDrive() {
  feedbackFolder_();
}
