# Changelog

All notable changes to this project will be documented in this file.

## [Current]
- **feat:** Update Resend email HTML templates in auth-member Edge Function to match Midnight Club Swiss Brutalism identity
- **chore:** Add midnight-club-brand and swiss-brutalism-ui skills, remove dead EmailJS code
- **feat:** Add IG Bulk Tools feature to birthdays tab (`3e0fd81`)
- **feat:** Update whatsapp message for birthdays, extracting first name (`05ccb09`)
- **fix:** Fix accept/reject member row exit animation and action handler bug (`7aaf9ac`)
- **feat:** Add cinematic row exit animation for approve/reject actions (`bd5401f`)
- **feat:** Migrate prototype to cms-members-app (Swiss Brutalism refactor 60% smaller footprint) (`3a21ab8`)
- **chore:** Checkpoint before swapping prototype to production (`512da9f`)
- **feat:** Add sort order toggle for member requests and clean up inline styles (`7068d27`)
- **feat:** Migrate birthday greeting to WhatsApp, new 5-shot copy, and Mon-Sun week display (`8fbec48`)
- **fix:** Fix duplicate member_id unique constraint error by delegating ID generation entirely to auth-member Edge Function (`6f67ac2`)
- **fix:** Fix IG bulk tool logic to open all tabs at once (`504b83c`)
- **feat:** Implement infinite scroll, a11y focus and brutalist header polish in cms-members (`5039796`)