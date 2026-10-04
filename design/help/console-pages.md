# HAIWAVE console — page guide (HAIWAVE Help knowledge pack)

<!-- Hand-maintained (DESIGN-2026-10-03 D10). One `## /route` per page, route patterns with [param]
     segments, the four fields below on every entry, `**Related:**` optional. The coverage test
     src/lib/help/__tests__/console-pages-coverage.test.ts fails when a nav item or Sourcing Map page has
     no entry. Write what a customer sees on the page; never describe how HAIWAVE implements it. -->

## /account/sonar/dashboard
**Page:** Sonar Observe › Dashboard
**For:** One landing view of your supply-chain visibility: compliance coverage, the partners observed across audits, watchers and phantom demand, and recent runs.
**You can:** check compliance coverage and its trend · compare observed partners across audit, phantom demand and watcher signals · review recent runs and open one · refresh the view · trigger every enabled configuration at once.
**Where:** the page heading reads "Sonar Dashboard". Three tabs: "Coverage" (shown first; "Compliance coverage" with tiles "Total products", "Complete", "Partial" and "No traversal", then "Coverage trend"), "Cross-modality" (tiles "Total partners observed", "Last run", "Throttled runs" and "Failed runs (30d)"; a "View all configurations" link with "Refresh" and "Run all" buttons; the "Partners observed by Sonar" table, sorted by clicking a column header) and "Activity" ("Recent activity", each run with an "Open →" link). Until a compliance audit has completed, Coverage says "No completed compliance snapshot yet."
**Related:** /account/sonar/audit, /account/sonar/watchers, /account/sonar/observations

## /account/sonar/observations
**Page:** Sonar Observe › Phantom Demand
**For:** Asking suppliers "if I needed N units of X, when could you deliver?" without committing to an order.
**You can:** create a saved request · run or re-run it · open its configuration · open the output of its latest completed run · clear its run history.
**Where:** "New request" (right side, above the table). The table lists each saved request with Request, SKU, Source ("Internal · BOM" or "Supplier · SKU"), Last run and Status. Each row ends with "↻ Run" (or "↻ Re-run"), "Config", "Output ›" (a link once a run has completed) and, once the request has run, a trash icon that clears its run history. With no requests yet the page shows "Create your first Phantom Demand request".
**Related:** /account/partners, /account/usage

## /account/sonar/watchers
**Page:** Sonar Observe › Watchers
**For:** Standing checks that watch your trading partners' signals and fire when they change.
**You can:** create a watcher · review drift alerts that need triage · view a watcher's runs or edit its configuration · switch the run list between active and archived runs · open a run.
**Where:** "+ New Watcher" (top right, beside the page title). A "Needs triage" strip appears only while there are active drift alerts, each with an "Open ›" link. "Configurations" is a collapsed section; expand it for the table, where each row's "Actions" menu has "View runs" and "Edit configuration". Under "Runs", an "Active" / "Archived" switch filters the list, and the chevron at the end of a row opens that run.
**Related:** /account/sonar/posture/changes, /account/sonar/dashboard

## /account/sonar/posture/changes
**Page:** Sonar Observe › Watcher Backlog
**For:** Working through the drift events your scheduled watchers detected: lead-time and order-promise degradations and improvements.
**You can:** filter events by date range, partner and kind · process an event to record an outcome and drop it from the active backlog · review events you already processed · refresh the feed.
**Where:** "Refresh" (top right, beside the page title). The filter bar has "Showing:" ("Active" or "Processed"), "From:" and "To:" dates, a "Partner:" list ("All partners" by default) and "Kind:" toggles ("lead time degraded", "lead time improved", "promise date slipped", "promise date improved", "upstream risk reported"). Each event row has a "Process" button, which reads "Processed" once the event is actioned. Long lists page with "‹ Prev" and "Next ›". The default window is 14 days.
**Related:** /account/sonar/watchers, /account/sonar/audit/events

## /account/sonar/supply-risks
**Page:** Sonar Observe › Supply Risks
**For:** Owning and closing the shortfalls that Sourcing Map runs traced below your direct suppliers.
**You can:** filter risks by status · set a risk's status and owner · keep a note and a next-review date · open the map that found the risk · page to older risks.
**Where:** status toggles "Open", "Contacted", "Resolving", "Resolved" and "Accepted" sit above the table; Open, Contacted and Resolving are on by default. Table columns: Supplier (with an "Open map" link when the run's map is available), Slot and products, Requested / covered, Origin, Status, Owner, Note and Next review. Status and Owner are drop-downs (Owner includes "Unassigned"); a note or a date saves when you leave the field; a closed risk shows plain text. "Show older" loads the next page. The nav item shows only for the Owner, Account Admin, Procurement Transact, Buyer Full Transact and Inside Sales Transact roles.
**Related:** /sourcing-map, /account/sonar/demand-exceptions

## /account/sonar/demand-exceptions
**Page:** Sonar Observe › Demand Exceptions
**For:** Reviewing planning probes that you answered below the quantity asked, with the cause.
**You can:** filter exceptions by cause · see what was asked, what was answered and the gap · go to Trust Posture when the cause is your posture · ignore an exception · page to older ones.
**Where:** the line "Planning probes — answers are not commitments." sits under the page title. Cause toggles "Own capacity", "Chain" and "Posture" filter the table. Table columns: Requestor, Product, Asked, Answered / gap, Cause, Times, and Age and status. A row whose cause is Posture carries a "Trust posture" link, and every row ends with "Ignore". "Show older" loads the next page. The nav item shows only for the Owner, Account Admin, Procurement Transact, Buyer Full Transact and Inside Sales Transact roles.
**Related:** /account/settings/trust-posture, /account/sonar/supply-risks, /sourcing-map

## /account/sonar/grounded-forecasts
**Page:** Sonar Observe › Grounded Forecasts
**For:** Turning a demand projection for a product you have not built yet into a dated commitment schedule, grounded in network quotes and your own delivery history.
**You can:** create a forecast · run it · change its configuration · open its latest result · delete it.
**Where:** "New forecast" (right side, above the table). Table columns: Forecast, Product, Demand profile and Last run. Each row ends with "Run now", "Configure", "Delete" (then "Confirm delete" or "Cancel") and "View". With no forecasts yet the page shows "Create your first grounded forecast".
**Related:** /account/sonar/observations

## /account/sonar/requests
**Page:** Sonar Observe › Request Management
**For:** Tracking nominations and obligations in both directions: what counterparties have asked of you and what you have asked of them.
**You can:** accept or decline a request addressed to you · withdraw a nomination you sent · start a new nomination · filter the queues · review items declined in the last 30 days.
**Where:** "+ New nomination" (top right, beside the page title). Four tabs: "Awaiting me", "Awaiting them", "All" and "Declined". The filter bar has "Item type:", "State:", "Counterparty:" and "Age:"; each filter you set shows as a chip you can click to remove, and "Clear all filters" appears once two or more are set. A row awaiting you carries "Accept" and "Decline"; Decline opens a dialog with "Reason (optional)", which the other party will see. A nomination you sent carries "Withdraw". The nav item carries a badge counting the requests awaiting you.
**Related:** /account/sonar/audit, /account/sonar/audit/events

## /account/sonar/inquiries
**Page:** Sonar Observe › Inquiry Log
**For:** A record of the qualified inquiries sent to you and by you, with their verdicts, commitments and guard activity.
**You can:** switch between inbound and outbound inquiries · open one inquiry · load more rows.
**Where:** two tabs, "Inbound" and "Outbound". Table columns: Requester, Subject, Attribute, Tier, Status, Outcome and Commitment (Inbound adds Guard trip); each row ends with "View". "Load more" appears when more rows exist. There is no composer on this page: inquiries are made by your agent. When the log is off for your console the page says "Inquiry log is not enabled for this console".
**Related:** /account/disclosure-policy, /account/attribute-classes, /account/settings/query-guard

## /sourcing-map
**Page:** Sonar Observe › Sourcing Map
**For:** Planning a product portfolio against your direct suppliers' capacity, drop by drop and size by size. This page lists your Sourcing Map projects.
**You can:** create a project · open a project · rename, archive or delete a project · show archived projects · switch between the light and dark theme · go back to the console.
**Where:** Sourcing Map opens as its own full-page app, without the console's side navigation. Its header carries the "Sourcing Map" title, a "Projects" breadcrumb, a "Supply Risks" link (with the open count), a theme button ("Light theme" or "Dark theme") and "Console", which returns to the System Dashboard. Under the "Projects" heading each project is a card with "Rename", "Archive" and "Delete"; click the project's name to open it. "Show archived" is a checkbox at the right of the heading. The "+ New project" card opens the "New project" dialog ("Project name", "Description (optional)", "Create project"). Deleting a project asks what to do with its "Earlier executions": archive, keep or delete them. Sourcing Map is open to the Owner, Account Admin, Procurement Transact, Buyer Full Transact and Inside Sales Transact roles; other roles do not see the nav item.
**Related:** /sourcing-map/[projectId], /account/sonar/supply-risks, /account/sonar/demand-exceptions

## /sourcing-map/[projectId]
**Page:** Sonar Observe › Sourcing Map › Projects › (project name)
**For:** One Sourcing Map project: its runs and its product library.
**You can:** create a run · open a run · delete a run · add a product to the library · open a product to edit its bill of materials · delete a product.
**Where:** two tabs, "Runs" and "Product library". Runs: "+ New run" creates a run and opens it; the table shows Run, Products, Last execution, Portfolio coverage and Status; click a run's name to open it, or "Delete" at the end of its row. Product library: "+ New product" opens the "New product" dialog ("Product name", "Unit label", "Assembly days", "Create product"); the table shows Product, Source, Variants, Lines and Ready; click a product's name to open it, or "Delete" at the end of its row. The "Projects" breadcrumb in the header leads back to the project list.
**Related:** /sourcing-map, /sourcing-map/[projectId]/products/[productId], /sourcing-map/[projectId]/runs/[templateId]

## /sourcing-map/[projectId]/products/[productId]
**Page:** Sonar Observe › Sourcing Map › Projects › (project name) › (product name)
**For:** Editing one product in a project's library: its name, unit, assembly days, size variants and bill of materials.
**You can:** rename the product and set its unit label and assembly days · choose a variant axis · add, edit and remove BOM lines · pick a class and suppliers for a line · upload a BOM file · import the BOM from your agent, as an editable copy or as a live link.
**Where:** the top card has "Product name", "Unit label", "Assembly days", a "Variant axis" block with "Variant preset", and "Save product". Below it, "Upload BOM" and "Import from agent" sit above the "Bill of materials" grid, which has "Add line" and "Save BOM". Grid columns: Component, Part ref, Class, Qty per unit, UoM, Size-bound and Suppliers; each line has "Add supplier" (available once the line has a class; with no supplier the line reads "Any trading partner") and "Remove line". "Import from agent" asks for a "Parent SKU" and a "Mode": copy into the workbench, or link, which is read fresh from your agent at every run. A linked product shows its bill of materials read-only, with the note "Read fresh at each run".
**Related:** /sourcing-map/[projectId], /sourcing-map/[projectId]/runs/[templateId]

## /sourcing-map/[projectId]/runs/[templateId]
**Page:** Sonar Observe › Sourcing Map › Projects › (project name) › (run name)
**For:** Configuring one Sourcing Map run, executing it, and reading the resulting map of supplier coverage.
**You can:** choose the run's products and their demand schedule · set run settings and a cadence · run it, and cancel an execution in progress · pick an earlier result to view · filter the map by drop and by product · open a supplier card's details · duplicate the run.
**Where:** the header carries a results drop-down (once the run has an execution; each entry is a date and a status), "Configure" and "Run"; under "Run" a line says why the run is not ready yet, or shows the slot and probe estimate. "Configure" opens a side tray with two tabs. "Products & demand": "Add a product from the library…" with "Add", "Upload schedule", and for each product "Up", "Down", "Remove" and a schedule with "Total", "First due", "Spacing", "Drops", "Shape" and "Generate drops". "Run settings": "Depth cap", "Seat weekly capacity (units per week, optional)" and "Cadence" ("Manual only", "Weekly (Mondays, 06:00 UTC)" or "Monthly (the 1st, 06:00 UTC)"). The tray ends with "Duplicate run", "Apply" and "Close". While an execution is running, "Cancel execution" appears above the map. Above the map, the "Portfolio demand" line shows the run's drops (select a drop to see the map at that drop), and "Filter by product" starts with "All products"; selecting a supplier card opens its details panel (Lead time, Utilization, Allocation, and coverage by drop), closed with "Close". Before the first execution the page says "No execution yet. Configure the run, then press Run."
**Related:** /sourcing-map/[projectId], /sourcing-map/[projectId]/products/[productId], /account/sonar/supply-risks

## /account/sonar/audit
**Page:** Sonar Audit › Audit Management
**For:** Running audits that verify a supplier's sourcing claims, and reviewing past runs across counterparties and SKUs.
**You can:** start a new audit · see your recurring audit configurations with their cadence and next fire time · view a configuration's runs or edit it · switch the history between active and archived runs · open any run.
**Where:** the page heading reads "Audits". "+ New Audit" (top right, beside the page title). "Scheduled configurations" lists recurring audits (Name, Cadence, Next fire, Scope, Status); each row's "Actions" menu has "View runs" and "Edit configuration". "Audit history" lists every run, with an "Active" / "Archived" switch and an "Open" link on each run; it refreshes every 15 seconds while the page is open.
**Related:** /account/compliance, /account/sonar/audit/events, /account/provenance-keys

## /account/compliance
**Page:** Sonar Audit › Audit Backlog
**For:** Triage of non-compliant audit findings: the latest non-compliant result per vendor and product from your audit runs over the last 7 days.
**You can:** expand a vendor to see each affected product · see the status and the issues for each product · open the audit run that detected an issue · start a new audit when nothing is listed.
**Where:** one card, "Non-compliant results from your recent audits", grouped by counterparty. Expand a vendor for a table with Product, Last run, Status ("Non-compliant" or "Partial") and Issues; click a product row to open its run. When nothing is listed the card offers a "start a new audit" link.
**Related:** /account/sonar/audit, /account/sonar/audit/events

## /account/sonar/audit/events
**Page:** Sonar Audit › Event Backlog
**For:** Triage of changes detected between audit snapshots: origin shifts, vendor substitutions, certification status and depth changes.
**You can:** filter events by severity, kind, partner and date · process an event to see its before-and-after detail and record an outcome · review processed events · switch to the Gaps and Obligations tabs · refresh the feed.
**Where:** "Refresh" (top right, beside the page title). Three tabs: "Events", "Gaps" and "Obligations". The filter bar has "Showing:" ("Critical Only" by default, "Warning Only", "All" or "Processed"), "Kind:" toggles ("origin shifted country", "origin shifted plant", "vendor substituted", "certification expired or revoked", "certification renewed", "depth reduced", "depth increased"), a "Partner:" box that takes a vendor ID, and "From:" and "To:" dates. Each event row has a "Process" button, which reads "Processed" once the event is actioned. The default window is 14 days. The nav item carries a badge counting events.
**Related:** /account/sonar/audit, /account/compliance, /account/sonar/posture/changes

## /account/provenance
**Page:** Sonar Audit › Product Provenance
**For:** A read-only, product-led view of what makes up your products: start at a product class and drill down to the origin manifest behind each SKU.
**You can:** search products by name or SKU · expand a product class to list its products · open a product's origin manifest.
**Where:** a search box, "Search products by name or SKU…", with "Clear" once you have typed. Below it, product classes are expandable rows; click a product to open a side drawer with its manifest (Product, External product ID (SKU), Manifest ID, Version, Domestic context and Updated, then its origin details). With no products the page says "No products registered yet."
**Related:** /account/sonar/audit, /account/manifests

## /account/provenance-keys
**Page:** Sonar Audit › Key Management
**For:** Issuing your own provenance keys and installing keys that counterparties issued to you; keys gate audit visibility in both directions.
**You can:** generate a key · show a key's value again · edit a key's permissions · revoke a key · install a key you were given, after previewing it · review and acknowledge an installation · uninstall a key.
**Where:** the page heading reads "Provenance Keys". Two tabs, "Generator" and "Installer". Generator: "Keys you've generated" with "Generate Key" at the right; the "Generate Provenance Key" dialog asks for "Friendly name", "Purpose (optional)", "Vendor policy URL (optional)", "Required fields" and "Requested fields (optional, cannot overlap required)", then "Generate". Click a key row for a drawer with "Show key", "Edit permissions" and "Revoke". Installer: "Your installations" with "Install Key"; the "Install Key" dialog has "Paste key", "Preview" and "Install". Click an installation for a drawer with "Uninstall" and, when the installation is not compliant, "Review & acknowledge".
**Related:** /account/manifests, /account/sonar/audit

## /account
**Page:** Account Management › System Dashboard
**For:** A snapshot of your account: alerts, notifications, connection and agent counts, your behavioral score and inbound quote volume.
**You can:** see an alert when your account is suspended or agents are unreachable · read notifications and mark them read · check your connection, trading-pair and online-agent counts · check inbound quote volume and how long requests have been waiting.
**Where:** an alert bar appears at the top only when something is wrong: "Account suspended", or an agent alert ("No agents are reachable", or a count of unreachable agents) with the link "Check agent health under Agents." Then the "Notifications" card (click a notification to mark it read), four tiles ("Total Connections", "Trading Pairs", "Agents Online", "Behavioral Score") and the "Quote Management" tiles ("Incoming Today", "Incoming This Week", "Incoming This Month", "Responded Today", "Outstanding in Queue", "Under 2 Days", "2 – 5 Days", "5+ Days" and "Expired (30d)"). The cards "Pending Requests", "Upcoming Billing" and "Agent Overview" currently show "Not Available".
**Related:** /account/agents, /account/scores, /account/partners

## /account/scores
**Page:** Account Management › Behavioral Scores
**For:** The reliability and response-time scores HAIWAVE assigns to you and to the vendors you trade with.
**You can:** see your own score and its components · compare yourself with your vendor cohort · see your trend by quarter · rank vendors by lowest score or by accelerating decline · open one vendor's score history.
**Where:** cards "Your score", "Vendor cohort benchmark", "Your trend" and "Vendor risk register". The register has two toggles, "Lowest current score" and "Accelerating decline", and columns Rank, Vendor, Current, 5Q trend and QoQ accel.; click a vendor row to open a drawer with "Composite trajectory" and "Per-component history". The score components are Fulfillment Reliability, Response Time, Price Adherence, Agent Uptime, Network Activity and Demand Verifiability.
**Related:** /account/partners, /account

## /account/partners
**Page:** Account Management › Trading Partners
**For:** Finding companies on HAIWAVE and managing your connections and trading pairs with them.
**You can:** search your partners or the HAIWAVE directory · request a connection · approve or deny incoming requests · propose or withdraw a trading pair · raise a trading pair to Premier · downgrade, remove or block a partner · view a partner's catalog · start a phantom demand request against a partner · set a disclosure override for one partner · set automatic approval rules.
**Where:** a search box with a "My partners" / "Directory" switch; Directory opens the "HAIWAVE Directory" dialog, where "Request Connection" and then "Send Request" send a request. Three tabs. "Approval Queue": filters for type, invite and sort order; each request has "Approve", "Approve as Trading Partner" and "Deny". "Active": each partner row has "View Catalog ›", "Run Phantom Demand", "Propose Trading Pair" (or "Withdraw Trading Pair"), "Disclosure Policy", "Remove" and "Block"; a trading pair also has "Raise to Premier" and "Downgrade". "Rules": cards "Bulk Pre-Approval Criteria", "Per-Request Rules", "Contact Route", "Blocklist", "Allowlist (Bulk Pre-Approval)" and "Test Rules", saved with "Save Rules".
**Related:** /account/partners/blocked, /account/disclosure-policy, /account/sonar/observations

## /account/partners/blocked
**Page:** Account Management › Blocked Companies
**For:** The companies you have blocked from sending you connection requests.
**You can:** see which companies are blocked, when and why · unblock a company.
**Where:** the nav item sits indented under Trading Partners. A table shows Company Name, Blocked Date and Reason; "Unblock" on a row opens the "Unblock Company" dialog, confirmed with "Unblock". To block a company, use "Block" on its row in Trading Partners › "Active". With nothing blocked the page says "No blocked companies".
**Related:** /account/partners

## /account/manifests
**Page:** Account Management › Manifests
**For:** Declaring your trading posture in both directions: what you require of the parties you buy from, and the documents, pricing and audit access you offer the parties who buy from you.
**You can:** set whether suppliers must share lead-time trend data · maintain your sell-side library and who may see each item · set your buy-side requirements for each trust tier · set baseline pricing terms, volume discount tiers and an aged-inventory discount · choose which fields your agent may share for provenance-key requests · review and approve companies · decide on counterparty updates and sync them.
**Where:** seven tabs. "Counterparty Manifest": "Lead Time Trend Sharing" ("Not Required", "Prefer" or "Require") and "Save Manifest". "Library — Sharing": click a cell to set who may see an item; "Gather from website" drafts items from your website. "Library — Requirements": click a cell to toggle a requirement. "Baseline Pricing": cards "General Terms", "Volume Discount Tiers" (with "Add Tier") and "Aged Inventory Discount", saved with "Save Pricing". "Audit Permissions": a field checklist with "Reset" and "Save". "Entity Approvals": "Pending", "Approved" and "All" filters and "Approve a company". "Counterparty updates": "Sync all now", "Status" and "Counterparty" filters, and decisions such as "Keep mine" or "Take theirs" on a pending row.
**Related:** /account/provenance-keys, /account/partners, /account/provenance

## /account/usage
**Page:** Account Management › Usage
**For:** Your hop consumption against your hourly budget, and the headroom you have left.
**You can:** see the hops used this hour against your budget · see the split between audit, watcher and phantom demand · chart consumption over 24 hours, 7 days or 30 days · see hops by counterparty · see active runs and throttle events · read your budget and your probe limit.
**Where:** the top line, "This hour:", shows hops used against your budget. Then the sections "Modality breakdown", "Hop consumption" (window buttons "24h", "7d" and "30d"), "Counterparty breakdown", "Active runs", "Throttle history (last 30 days)" and "Budget", which shows your hourly budget and your phantom demand inbound probe limit and gives support@haiwave.ai for a higher limit.
**Related:** /account/sonar/dashboard, /account/settings/query-guard

## /account/data-cleansing
**Page:** Account Management › Data Cleansing
**For:** Reviewing the products your agent could not classify automatically, and resolving them by hand.
**You can:** assign a product to a class yourself · request a new class · mark an item as not a product · dismiss an item from the queue.
**Where:** a table with Product ID, Reason, Classified and Actions; each row has "Force-assign", "New node", "Not a product" and "Dismiss". Each opens a dialog with "Reason (optional)" and "Apply"; Force-assign adds "Select concept node", and New node adds "Proposed label" and "Description". An empty queue reads "No unclassifiable products — all products have been classified successfully."

## /account/profile
**Page:** Account Management › Company Profile
**For:** The company information other participants see on the HAIWAVE network.
**You can:** edit your legal and DBA names · set your business type and website · edit your address · add or remove plant locations · set a contact phone and email · write your company description · add other names buyers search for.
**Where:** sections "Identity" ("Legal Company Name", "DBA Name"), "Business Details" ("Business Type", "Tax ID / EIN", "DUNS Number", "Website"), "Address", "Plant locations" ("Add plant", "Remove"), "Contacts" ("Phone", "Email") and "Network Profile" ("Company Description", "Other names & abbreviations"), then "Save Changes". Changing the legal name asks you to confirm in a "Confirm Changes" dialog. Tax ID / EIN and DUNS Number are not saved from this form. Without an admin-level role (Owner, Account Admin, Procurement Transact, Buyer Full Transact or Inside Sales Transact) the page is read-only and says "You have read-only access. Contact your account owner to make changes."
**Related:** /account/partners

## /account/settings/trust-posture
**Page:** Account Management › Trust Posture
**For:** How your agent treats counterparties' audit, watcher and phantom demand requests, by trust class.
**You can:** set a posture for each modality and trust class · opt out of individual watcher signal types · switch on "Answer for myself only" for Sourcing Map runs.
**Where:** a grid headed "Modality \ Trust Class", with rows audit, watcher and phantom_demand and columns unknown, behavioral_only, trading_pair and premier_partner. Click a cell to open a drawer with the "Posture" options permissive, manual and opt_out, then "Save"; a watcher cell set to permissive also shows "Opt out of signal types". Changes apply immediately. Under the grid is the switch "Answer for myself only — Sourcing Map runs don't go below you; your suppliers are never probed through you."
**Related:** /account/settings/query-guard, /account/disclosure-policy, /account/sonar/demand-exceptions

## /account/settings/query-guard
**Page:** Account Management › Query Guard
**For:** Limits on how counterparties may query you: thresholds, windows and enforcement actions, by trust class.
**You can:** edit a rule for all counterparties or for one trust class · reset a rule to its default · test your rules against a hypothetical pattern · restore a blocked counterparty or clear elevated logging · review past guard trips · choose the inquiry configuration pack.
**Where:** "Test rules" (right side, above the grid) opens a drawer that ends with "Run test". The grid is headed "Rule \ Class", with columns "All counterparties", "Unknown", "Behavioral only", "Trading pair" and "Premier partner" and rows sku_repeat, sku_breadth, ad_hoc_cap and excess_volume. Click a cell to open a drawer with "Threshold", "Window", "Origin filter", "Actions" ("Alert", "Pause", "Log", "Block"), "Enabled", "Save" and, for a rule you have changed, "Reset to default". Below the grid: "Active enforcement" ("Restore" on a block, "Clear" on a logging state), "Trip history" (filters "Counterparty" and "Rule type") and "Inquiry-door configuration pack" ("Guarded", "Standard" or "Open").
**Related:** /account/settings/trust-posture, /account/disclosure-policy, /account/sonar/inquiries

## /account/disclosure-policy
**Page:** Account Management › Disclosure Policy
**For:** How your agent answers qualified inquiries (the value, a verdict, or nothing), by attribute class and trust class.
**You can:** choose a disclosure for each attribute class and trust class · choose whether to disclose a shortfall quantity · opt in or out of the evaluation room, for all classes or per class · set overrides for one counterparty.
**Where:** a grid headed "Attribute class / Trust class", with columns "Unknown", "Behavioral-only", "Trading pair" and "Premier partner". Each cell has a drop-down ("Raw value", "Qualified verdict" or "Declined") and a "Disclose shortfall" checkbox; a change is saved as you make it. Below the grid: "Participate in the evaluation room (all classes)" and one checkbox per class. Overrides for a single counterparty open from that partner's "Disclosure Policy" link in Trading Partners › "Active", under the heading "Override for counterparty".
**Related:** /account/attribute-classes, /account/partners, /account/sonar/inquiries

## /account/attribute-classes
**Page:** Account Management › Attribute Classes
**For:** The registry of attributes that qualified inquiries can be asked about, and a way to propose a new one for platform adoption.
**You can:** see the adopted classes · propose a new class · follow your proposals and their status.
**Where:** three sections: "Adopted classes", "Propose a new class" (a form that starts with "Attribute class id" and "Display name" and ends with "Propose") and "Your proposals".
**Related:** /account/disclosure-policy, /account/sonar/inquiries

## /account/users
**Page:** Admin › Users
**For:** Managing the people in your organization who can sign in to this account, and their roles.
**You can:** invite a user · change a user's name or role · deactivate a user · delete a user.
**Where:** "Invite User" (right side of the bar above the user table) opens the "Invite User" dialog: "First Name", "Last Name", "Email Address", "Role" and "Send Invitation". The table shows Name, Role, Status and Last Login; every row except the Owner's has "Edit", "Deactivate" (active users only) and "Delete". An email address cannot be changed: delete the user and invite them again. The roles you can assign are Account Admin, Procurement Read Only, Procurement Transact, Buyer View Only, Buyer Request Quote, Buyer Full Transact, Inside Sales Read Only and Inside Sales Transact. Only the account Owner can open this page; other roles are sent to the System Dashboard.
**Related:** /account/security

## /account/billing
**Page:** Admin › Billing
**For:** Subscription, payment methods and invoice history for your HAIWAVE account.
**You can:** nothing yet; the page shows "Coming soon".
**Where:** under the "Billing" heading, a "Coming soon" card says that subscription, payment methods and invoice history will appear here. Only the account Owner can open this page; other roles are sent to the System Dashboard.

## /account/security
**Page:** Admin › Sign-in & Security
**For:** Managing your own password, two-factor authentication and passkeys for signing in to HAIWAVE.
**You can:** change your password · set up an authenticator app · register a passkey (Touch ID or a security key).
**Where:** one card with the button "Manage sign-in & security →". It opens the HAIWAVE identity console in the same tab, where those settings live; the "Back to HAIWAVE" link there returns you to the console.
**Related:** /account/users

## /account/agent-health
**Page:** Agents › Agent Health
**For:** Availability and dispatch health of your deployed agents.
**You can:** nothing yet; the page shows "Coming soon". For now, the System Dashboard shows how many agents are online and raises an alert when agents are unreachable.
**Where:** under the "Agent Health" heading, a "Coming soon" card says that live agent availability (healthy, quiet or unreachable) with last-interaction times will appear here. The "Health" link on each agent card in Agent Provisioning leads to this page.
**Related:** /account, /account/agents

## /account/agent-software
**Page:** Agents › Agent Software
**For:** Downloading the configuration guide and the HAIWAVE agent source archive.
**You can:** download the Configuration Guide (PDF) · download the HAIWAVE Agent source archive (ZIP) with its version, size and build date.
**Where:** two download cards, "Configuration Guide (PDF)" and "HAIWAVE Agent — Source Archive (v<version>)", each with a "Download" button; a card shows "Not yet published" instead when its file has not been published yet.
**Related:** /account/agents

## /account/agents
**Page:** Agents › Agent Provisioning
**For:** Creating the HAIWAVE agents that act for your organization and managing their network credentials.
**You can:** create an agent · copy its client secret (shown once) · download its config `.env` · rotate its secret · revoke it · follow its Health link.
**Where:** "Create agent" (right side, above the agent list) opens a dialog asking for a Name; after "Create", the "Agent credentials" dialog shows the client secret once, with "Copy secret", "Download config .env" and "Done". Each agent card carries Health · Download .env · Rotate · Revoke (Rotate and Revoke disappear once an agent is revoked); Rotate shows the new secret once, in the same dialog. With no agents yet the page says "No agents provisioned yet" and links to Agent Software. Viewing and managing agents needs an admin-level role: Owner, Account Admin, Procurement Transact, Buyer Full Transact or Inside Sales Transact.
**Related:** /account/agent-health, /account/agent-software

## Glossary
**Agent** — the HAIWAVE reference agent (or your own conforming agent) that acts for your organization on the network; it runs on your infrastructure.
**Client secret** — the one sensitive credential of an agent, shown once on creation or rotation; everything else in its config `.env` is non-secret.
**Config .env** — the downloadable file of an agent's non-secret settings; it carries a commented placeholder where the client secret goes.
**healthy / quiet / unreachable / not deployed** — the agent availability states: recent traffic; no traffic for a while (four hours by default); Central's dispatches to the agent are failing; no endpoint registered yet.
**Sonar** — the console's supply-chain visibility area: Sonar Observe (supply chain monitoring) and Sonar Audit (compliance auditing).
**Modality** — one of the three kinds of Sonar observation: audit, watcher or phantom demand.
**Phantom demand** — synthetic-demand probes that test counterparty capacity and lead times without committing to an order.
**Watcher** — a standing check that fires when a counterparty signal changes, such as a lead time or an order promise.
**Watcher Backlog** — the drift events your watchers detected: lead-time and order-promise degradations and improvements.
**Drift event** — a change a watcher detected, such as a vendor's lead time growing past its threshold or a booked order line's schedule moving later than promised.
**Audit** — a run that verifies one supplier's sourcing claims, scoped to a whole catalog, a product class or specific SKUs.
**Configuration** — a saved audit or watcher setup with its scope and cadence; it runs on its schedule or when you trigger it.
**Audit Backlog** — the latest non-compliant result for each vendor and product from your audit runs over the last 7 days.
**Event Backlog** — changes detected between audit snapshots: origin shifts, vendor substitutions, certification status and depth changes.
**Coverage** — on the Sonar Dashboard, how many in-scope products have complete evidence, partial evidence, or could not be reached by the audit (no traversal).
**Nomination** — a request that names a counterparty for an audit scope; the nominated party accepts or declines it in Request Management.
**Obligation** — a request to fulfil a SKU-level compliance requirement, tracked in Request Management.
**Qualified inquiry** — a question one participant's agent asks another's about an attribute; the answer is the raw value, a qualified verdict or a decline, as the responder's disclosure policy decides.
**Attribute class** — a registered kind of attribute that a qualified inquiry can be asked about.
**Trust class** — the tier a counterparty falls in for you: unknown, behavioral-only, trading pair or premier partner; trust posture, query guard rules and disclosure policy are set per trust class.
**Trust posture** — how aggressively your agent trusts and acts on signals coming from counterparties.
**Query guard** — rate and volume limits that protect your inventory from counterparty probing.
**Guard trip** — one firing of a query guard rule against a counterparty, listed under Trip history on the Query Guard page.
**Disclosure policy** — how your agent answers qualified inquiries, by attribute class and trust class.
**Provenance key** — a key you issue or accept that gates audit visibility between you and a counterparty.
**Generator / Installer** — the two sides of a provenance key: the generator issues the key, the installer accepts and installs it.
**Manifest** — the counterparty and pricing configuration that drives your agent's access rules and quoted prices.
**Library** — on the Manifests page, the documents and business terms your company holds for the parties who buy from you, each with a permission level.
**Origin manifest** — the origin record declared for a product, shown under Product Provenance.
**Connection** — an approved relationship between your company and another on HAIWAVE; your agents transact with each other only once it becomes a trading pair.
**Trading pair** — a connection that both parties have proposed to activate; once active, your agents can search inventory, exchange quotes and place orders with each other.
**Premier** — the trust class above trading pair; you raise a trading pair to Premier yourself, and it needs no acceptance from the other party.
**Behavioral score** — the score HAIWAVE calculates for a participant from fulfillment reliability, response time, price adherence, agent uptime, network activity and demand verifiability.
**Hop** — the unit your hourly usage budget is counted in; audit, watcher and phantom demand runs consume hops.
**Sourcing Map** — the planning app opened from Sonar Observe; it tests a product portfolio against your direct suppliers' capacity, drop by drop and size by size.
**Project** — in Sourcing Map, a set of runs together with a product library.
**Run** — in Sourcing Map, a saved selection of products and demand that you execute to produce a map; earlier results stay selectable from the results drop-down in the run's header.
**Drop** — in Sourcing Map, one dated quantity in a product's demand schedule.
**Slot** — in Sourcing Map, one component need on the map, shared by the products that use it, with the suppliers that could fill it.
**Seat** — in Sourcing Map, your own company's place on the map.
**BOM** — bill of materials: the component lines that make up a product.
**Supply risk** — a shortfall that a Sourcing Map run traced below your direct suppliers, kept on the Supply Risks page until it is resolved or accepted.
**Demand exception** — a planning probe you answered below the quantity asked, listed with its cause: own capacity, chain or posture.
**Grounded forecast** — a demand projection for a product you have not built yet, turned into a dated commitment schedule from network quotes and your own delivery history.
