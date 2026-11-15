#!/usr/bin/env node
/**
 * Feedback Moderation Agent Script
 * Reads the Feedback sheet via gsheets CLI, auto-categorizes,
 * drafts agent replies, and either auto-approves or flags for Phil.
 *
 * Usage:
 *   node scripts/moderate-feedback.js           (Dry run - preview moderation)
 *   node scripts/moderate-feedback.js --apply   (Write approvals/replies to Sheet)
 */

const { execSync } = require('child_process');

const SPREADSHEET_ID = '1F7mRsziPoYb5U4FvtLix1GlBgS4Do8LL5X36RZTLZXE';
const isApply = process.argv.includes('--apply');

console.log(`\n🤖 --- Weather Dashboard Feedback Moderation Agent ---`);
console.log(`Mode: ${isApply ? 'APPLY (Writing changes to Sheet)' : 'DRY RUN (Preview only, use --apply to commit)'}\n`);

try {
  const raw = execSync(`gsheets readonly read ${SPREADSHEET_ID} "Feedback!A1:J100"`, { encoding: 'utf8' });
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) {
    console.log('No feedback rows found to moderate.');
    process.exit(0);
  }

  const headers = lines[0].split('\t');
  console.log(`Found ${lines.length - 1} total feedback row(s) in sheet.\n`);

  let pendingCount = 0;
  let approvedCount = 0;
  let flaggedCount = 0;

  for (let idx = 1; idx < lines.length; idx++) {
    const rowNum = idx + 1;
    const cols = lines[idx].split('\t');
    const timestamp = cols[0] || '';
    const stars = parseInt(cols[1] || '5', 10);
    const location = cols[2] || 'Local';
    const comment = (cols[3] || '').trim();
    let status = (cols[4] || '').trim();
    let agentReply = (cols[5] || '').trim();
    let category = (cols[6] || '').trim();

    // Check if entry needs moderation
    if (!status || status.toLowerCase() === 'pending' || status.toLowerCase() === 'unreviewed') {
      pendingCount++;
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[Row ${rowNum}] FROM: ${location} | RATING: ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)} | DATE: ${timestamp}`);
      console.log(`COMMENT: "${comment}"`);

      // 1. Classification & Reply Drafting
      const lower = comment.toLowerCase();
      let proposedStatus = 'Approved';
      let proposedCategory = 'General';
      let proposedReply = agentReply;

      const isPraise = /love|great|genius|saved|brilliant|awesome|fantastic|excellent|good job|thanks|thank you|best/.test(lower) || stars === 5;
      const isBug = /bug|broken|error|crash|fail|not working|issue|glitch|freeze/.test(lower);
      const isFeature = /feature|could you|please add|can you add|would like|request|suggest|wish|option/.test(lower);
      const isFrost = /frost|freeze|windscreen|ice|cold|dew point/.test(lower);
      const isRadar = /radar|rain|precipitation|shower|storm/.test(lower);
      const isCast = /cast|tv|chromecast|shield|screen/.test(lower);

      if (isBug) {
        proposedCategory = 'Bug Report';
        proposedStatus = 'Flagged for Phil';
        if (!proposedReply) {
          proposedReply = "Thanks for reporting this! We are investigating this issue right away.";
        }
      } else if (isFeature) {
        proposedCategory = 'Feature Request';
        proposedStatus = 'Flagged for Phil';
        if (!proposedReply) {
          proposedReply = "Great suggestion! This has been queued for Phil's review for future dashboard updates.";
        }
      } else if (isFrost) {
        proposedCategory = 'Frost / Winter';
        proposedStatus = 'Approved';
        if (!proposedReply) {
          proposedReply = "Glad the frost prediction is helpful! It checks radiative cooling and dew point between 05:00 and 08:00 AM.";
        }
      } else if (isRadar) {
        proposedCategory = 'Rain & Radar';
        proposedStatus = 'Approved';
        if (!proposedReply) {
          proposedReply = "Rain radar loops use 10-minute Bureau/EUMETSAT radar sweeps with active precipitation color-coding.";
        }
      } else if (isCast) {
        proposedCategory = 'Google Cast';
        proposedStatus = 'Approved';
        if (!proposedReply) {
          proposedReply = "Casting keeps your TV synced live with your phone or tablet location via bi-directional cast messaging.";
        }
      } else if (isPraise) {
        proposedCategory = 'Praise';
        proposedStatus = 'Approved';
        if (!proposedReply) {
          proposedReply = "Thank you so much! We're thrilled you're enjoying the weather dashboard.";
        }
      } else {
        proposedCategory = 'Feedback';
        proposedStatus = stars >= 4 ? 'Approved' : 'Flagged for Phil';
        if (!proposedReply) {
          proposedReply = "Thank you for sharing your feedback with the community!";
        }
      }

      console.log(`PROPOSED CATEGORY: [${proposedCategory}]`);
      console.log(`PROPOSED STATUS:   [${proposedStatus}]`);
      console.log(`PROPOSED REPLY:    🤖 "${proposedReply}"`);

      if (proposedStatus === 'Approved') approvedCount++;
      if (proposedStatus === 'Flagged for Phil') flaggedCount++;

      // 2. Apply to Google Sheets if requested
      if (isApply) {
        // Safe cell write: escape literal commas
        const safeComment = comment.replace(/,/g, '\\,');
        const safeReply = proposedReply.replace(/,/g, '\\,');
        const safeLocation = location.replace(/,/g, '\\,');

        // Update Status (Col E), Agent Reply (Col F), Category (Col G)
        const cellRange = `Feedback!E${rowNum}:G${rowNum}`;
        const values = `${proposedStatus},${safeReply},${proposedCategory}`;
        execSync(`gsheets mutate write ${SPREADSHEET_ID} "${cellRange}" "${values}"`);
        console.log(`✓ Row ${rowNum} updated in Google Sheet.`);
      }
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  if (pendingCount === 0) {
    console.log(`All feedback rows are already moderated! No action needed.`);
  } else {
    console.log(`Moderation Summary: ${pendingCount} pending row(s) processed.`);
    console.log(`  - Auto-Approved: ${approvedCount}`);
    console.log(`  - Flagged for Phil: ${flaggedCount}`);
    if (!isApply) {
      console.log(`\nTo write these replies and approvals to your Sheet, run:`);
      console.log(`  node scripts/moderate-feedback.js --apply\n`);
    }
  }
} catch (err) {
  console.error('Error during feedback moderation:', err.message);
  process.exit(1);
}
