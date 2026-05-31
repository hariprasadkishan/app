# TruEd MVP Backend Architecture Context Document

## 1. Executive Project Summary
TruEd is a high-performance marketplace platform designed to seamlessly connect students and educators, modeling operational patterns akin to industry standards like UrbanPro. This document outlines the technical architecture, domain models, utility abstractions, and database guardrails developed for the platform's Minimum Viable Product (MVP).

### Core Operational Workflows Engineered:
*   **Decoupled Identity & Profiles:** Minimal authentication foot-print paired with rich professional metadata collections.
*   **Strict Financial Isolation:** Storing transactional figures inside an un-splittable monetary system with a double-entry style design for automated platform commission and escrow workflows.
*   **Weekly Scheduling Engine:** Time-slot locking systems with embedded strict checking loops to guarantee zero double-bookings.
*   **Automated Lifecycle Guardrails:** Built-in hooks, automated indexing, and state-machine transitions directly embedded within the database layer.

---

## 2. Global Directory & Directory Topology
Adhering to the modular structure reflected in `image_7cbf34.png`, the system isolates business sub-domains from execution wrappers:

```text
Backend/
├── node_modules/
├── src/
│   ├── constants/
│   │   └── enums.js             # Central registry for statuses, roles, and static validation arrays
│   ├── controllers/             # Request handlers orchestration (TBD)
│   ├── db/
│   │   └── index.js             # MongoDB asynchronous connection protocol utilizing Mongoose
│   ├── middlewares/            # Route level guards and verification wrappers (TBD)
│   ├── models/
│   │   ├── index.js             # Single aggregation import/export point for all schemas
│   │   ├── Booking.model.js     # Session lifecycles and historical policy snapshots
│   │   ├── Document.model.js    # Append-only instructor verification and verification engine
│   │   ├── OtpSession.model.js  # Temporary brute-force protected authentication tokens
│   │   ├── Payment.model.js     # Ledger maps tracking inbound Razorpay payment transactions
│   │   ├── Payout.model.js      # Outbound merchant settlement pools with delay configurations
│   │   ├── RefundRequest.model.js# SLA-backed client grievance resolution system
│   │   └── User.model.js        # Normalized multi-role root security credentials
│   ├── routes/                  # Express Router layout configurations (TBD)
│   ├── services/                # Heavy programmatic multi-document operations (TBD)
│   ├── utils/
│   │   ├── ApiError.js          # Unified structural error framework extending global Error class
│   │   ├── ApiResponse.js       # Standardized response contract format for frontend consumers
│   │   ├── asyncHandler.js      # Functional wrapper managing unhandled Promise rejections
│   │   ├── cloudinary.js        # File distribution systems integration layer
│   │   └── schema.utils.js      # Shared schemas, global serialization filters, and validation regex
│   ├── app.js                   # Application instantiation wrapper configuring CORS, JSON parsing, and cookies
│   ├── constants.js             # Shared configurations, parameters, and database instance names
│   └── index.js                 # Operational process bootstrap script initiating db connections and listeners
├── .env                         # Isolated sensitive keys and deployment environment vectors
├── .gitignore                   # Version control system visibility rule listings
├── package-lock.json            # Deterministic package installation locks
└── package.json                 # Dependency version locks and runnable script manifests

3. Foundation Layers & Global Configuration Frameworks
A. Environment Context & Configuration Core (.env, src/constants.js)

    Runtime Context: Runs on a configurable server architecture (PORT=8000), declaring explicit connection pooling targets against MongoDB clusters hosted on app namespaces.

    CORS Configurations: Establishes precise handshake boundaries allowing credential evaluation exclusively for local development clients (http://localhost:5173).

    Cloudinary Integrations: Houses keys for image storage pipelines.

B. High-Performance Server & Bootstrapping (src/app.js, src/index.js)

    Request Pre-processing: Leverages standard Express middle-layers for processing explicit incoming data payloads up to internal safety constraints:

        express.json() handles raw structured payloads.

        express.urlencoded({ extended: true }) captures complex browser address parameters.

        cookieParser() deserializes signed secure tracking cookies.

    Asynchronous Bootstrapping: Application lifecycles do not initialize until the asynchronous database connection verification within src/db/index.js yields a successful handshake instance, cleanly crashing with code process.exit(1) upon downstream timeout or rejection.

4. Architectural System Utilities (src/utils/)
A. Operational Pipeline Wrappers (ApiError.js, ApiResponse.js, asyncHandler.js)

    Unified Errors (ApiError): Implements an operational class structure enforcing strict interface tracking (statusCode, errors[], success = false, and tracking execution traces via Error.captureStackTrace).

    Response Contracts (ApiResponse): Enforces a reliable structural format for client parsers: { statusCode, data, message, success }, where statuses below 400 automatically trigger true evaluations.

    Asynchronous Isolation (asyncHandler): Eliminates messy individual try-catch blocks inside upcoming controllers by wrapping functional request executions inside a clean standard structure: Promise.resolve(handler()).catch(next).

B. Media Processing Interceptors (cloudinary.js)

    Safe File Transfers: Implements an automated local-to-cloud file pipeline. Incoming multipart requests are temporarily cached to local disk via file systems. The handler ships files to Cloudinary, then uses an absolute cleanup execution block (fs.unlink(localFilePath)) running within both success and failure blocks to eliminate zombie media leaks on server nodes.

C. Reusable Database Schema Helpers (schema.utils.js)

Provides programmatic building blocks shared directly across all platform models:

    JSON Transforms (jsonTransform): Automatically re-writes structural database layouts when objects are formatted for frontend transmission. It casts internal Object IDs into clean strings (ret.id = ret._id.toString()), completely purges standard internal database fields (__v), and deletes model-specific dynamic tracking arrays (__sensitiveFields).

    The Monetary Standard (moneyField): Prevents floating-point precision bugs (0.1 + 0.2 !== 0.3) by forcing all monetary parameters down to integer formats representing Paise (e.g., ₹150.00 is strictly evaluated as 15000). It blocks negative numbers natively via core validation guards (min: 0).

    Geospatial Models (geoPointSchema): Enforces a formal structural format mapping valid global points: { type: "Point", coordinates: [lng, lat] }, executing strict numeric coordinate boundaries via custom range validation: Longitude must reside between -180 and 180, and Latitude must map precisely within -90 and 90.

    Audit Sub-document Tracking (auditSchema): Implements embedded trails (reviewedBy, reviewedAt, reviewNote, adminAction) across models requiring manual authorization loops (KYC documents, claims, payouts).

5. Centralized State Machines & Data Enums (src/constants/enums.js)

Provides absolute system safety by preventing spelling errors across business domains through strict runtime object sealing (Object.freeze).

    Platform Governance (ROLES): Governs resource gating via student, teacher, and admin.

    KYC Processing Matrix (DOCUMENT_TYPE, DOCUMENT_STATUS, VERIFICATION_STATUS):

        Tracks identity via identity_proof (Aadhaar/PAN abstraction), professional credentials via degree/certificate, and structural financial accounts via bank_passbook.

        Manages files via a precise life flow: uploaded → under_review → approved / rejected.

    The Session Engine Workflow (BOOKING_STATUS): Establishes explicit transactional sequence markers: pending (unpaid checkout checkout state) → confirmed (escrow funded) → in_progress (session live) → completed (eligible for payout settlement) → cancelled / disputed → refunded.

    Financial Gateways Logs (PAYMENT_STATUS, ESCROW_STATUS, PAYOUT_STATUS, PAYOUT_STAGE):

        PAYMENT_STATUS maps directly to inbound webhooks matching external APIs: created, captured, failed, refunded.

        ESCROW_STATUS locks capital securely during educational sessions via: holding, released, refunded.

        PAYOUT_STATUS processes outbound corporate bank settlement arrays through: queued → processing → completed / failed / on_hold.

6. Granular Database Models Architecture & Deep-Dive Logic (src/models/)

All system schemas natively inject advanced query caching and optimization hooks via global plugins: mongoosePaginate (paginated batch fetches via lightweight parameters), and mongooseLeanVirtuals (allowing fast processing performance while keeping virtual property logic intact).
A. The Identity Layer (User.model.js)

    Strategy: Single-collection strategy wrapping students, teachers, and admins simultaneously. Eliminates redundant query routers and duplicates code across routing points.

    Advanced Index Configuration:

        email: Configured with { unique: true, sparse: true }. This enables regional students without email access to sign up seamlessly with phone profiles alone, while still enforcing uniqueness checks only on profiles where an email address is actively provided.

        Compound Indexes: Optimizes standard query searches via paired index tracks: { role: 1, isActive: 1 } for active users, and { role: 1, createdAt: -1 } for fresh sign-ups.

    Instance Automation:

        softDelete() swaps active status indicators while logging timestamps (deletedAt), preventing permanent data removal to protect historical bookkeeping audit paths.

        signupAnalytics() executes a multi-stage aggregate matrix ($match → $group → $sort), parsing sign-up logs into clean date strings (%Y-%m-%d) mapped to user counters for administrative analytics panels.

B. The Professional Instructor Layer (TeacherProfile.model.js)

    Strategy: Keeps root identity items highly efficient by isolating heavy dynamic professional parameters (bio records, language options, media payloads) into a standalone table linked via a unique relational identifier (userId).

    Availability Matrix System: Embedded sub-documents (availableSlotSchema) capture recurring profiles (0 for Sunday up to 6 for Saturday). By deploying an embedded _id: true configuration on slot objects, down-stream service handlers can target and modify single specific booking targets instantly using Mongoose's native lookup logic: this.availableSlots.id(slotId).

    Compound Text Index Engine: Employs a custom weighted text optimization strategy over search terms:

JavaScript

    { searchKeywords: 'text', headline: 'text', bio: 'text' }
    { weights: { searchKeywords: 10, headline: 5, bio: 1 } }
    ```
    This completely eliminates reliance on expensive runtime evaluation scripts (regex lookups) by matching query targets directly against lightweight computed tags populated via standard internal automation arrays during pre-save hooks (`searchKeywords`).
*   **Sync Automation Mechanics:** A pre-save lifecycle listener guarantees instant coordination with the root account collection. Whenever an administrative reviewer alters an instructor's verification status, a background sync pipeline writes updates directly to the parent registry:
```javascript
    this.model('User').updateOne({ _id: this.userId }, { kycStatus: this.verificationStatus })
    ```

### C. The Central Core Scheduler Layer (`Booking.model.js`)
*   **Strategy:** Serves as the master interaction document connecting financial ledger entries, scheduling records, and refund procedures.
*   **Downstream Rate Snapshot Isolation:** The model copies pricing metrics directly during checkout creation (`hourlyRatePaise`, `platformFeePercent`). This completely protects old booking logs from breaking whenever a teacher updates their current marketplace rates.
*   **Unbreakable Double-Booking Prevention:** Employs a defensive scheduling interceptor (`hasConflict`) running direct mathematical expressions on temporal limits:
```javascript
    status: { $in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.IN_PROGRESS] }
    ```
This protects the ecosystem against concurrent checkout operations by keeping time-slots completely locked the moment a student hits the payment step (`PENDING`), preventing duplicate checkouts for the same window.

### D. The Verification Processing Layer (`Document.model.js`)
*   **Strategy:** Strict **Append-Only** transaction rules. Old verification logs are never mutated or modified during re-upload cycles.
*   **Lifecycle Hook Automation:** Fresh updates automatically route old files to inactive tracking states inside data triggers:
```javascript
    await this.constructor.updateMany({ teacherId: this.teacherId, type: this.type, _id: { $ne: this._id } }, { $set: { isActive: false } })
    ```
This approach keeps historical audits perfectly intact while establishing a clear visibility trace for active verification records (`isActive: true`).

### E. The Gateway & Security Logs Layer (`OtpSession.model.js`)
*   **Strategy:** Implements core brute-force and rate-limit guardrails directly at the database layer.
*   **Self-Cleaning Lifecycles:** Deploys native database triggers (`expireAfterSeconds: 0`) on expiration targets (`expiresAt`), shifting processing loads away from server processes by offloading expired session cleanup directly to MongoDB's internal background worker routines.
*   **Security Lockout Mechanics:** Tracks login failures using internal limits (`incrementAttempt()`). The moment a profile crosses 5 bad entries, the engine automatically calculates an active lockout stamp (`lockedUntil = Date.now() + 15 mins`), completely blocking verification access until the timeout window safely clears.

### F. Inbound Transaction Capital Infrastructure (`Payment.model.js`)
*   **Strategy:** Formulates a strict 1:1 matching architecture with parent scheduling entries.
*   **Immutable Webhook Ledger Trails:** Contains an inner append-only log model (`webhookEvents`) designed to record full event payloads sent by payment gateway partners. If a platform node drops a data packet or experiences an outage mid-transaction, administrators can accurately replay the entire event sequence without external tracking logs.
*   **Safe Settlement Allocations:** The model processes partial adjustments inside clean calculation functions (`addRefund`), keeping financial distributions balanced by scaling cumulative data states directly alongside partner platform updates.

### G. Outbound Settlement Infrastructure (`Payout.model.js`)
*   **Strategy:** Tracks capital distribution flows from platform escrow nodes out to teacher bank accounts.
*   **Automated Fault-Tolerance Systems:** Implements programmatic back-off routines (`markFailed()`) to manage downstream bank network drops. Failed processing actions invoke automatic transaction delayed intervals scaled exponentially across sequential retry counts:
```javascript
    const backoffs = [15, 60, 240, 720, 1440]; // Delays mapped explicitly in minutes
    ```
*   **Administrative Hold Safeguards:** Features an internal control override flag (`onHold`). This allows security reviewers to instantly freeze transaction processing pipelines on suspicious accounts without breaking active database operations or throwing gateway errors.

### H. Resolution & Grievance Systems (`RefundRequest.model.js`)
*   **Strategy:** Fully decoupled from core monetary ledger tracking to manage administrative dispute review workflows independently.
*   **SLA Compliance Enforcement:** Automatically calculates fixed resolution deadlines (`slaDeadline = CreatedAt + 72 Hours`) upon creation. This fuels automatic operational metrics reporting queries (`slaBreaches`), enabling administrative dashboards to track and flag unresolved customer issues before they violate service compliance windows.


## 7. TruEd Marketplace Engine: Core Features & End-to-End Operational Flows

This section maps the dynamic business logic of the TruEd MVP, outlining how requests move through the models, how the state machine transitions, and how third-party integrations (Razorpay, Cloudinary) interact with the database layer.

---

### A. The Passwordless Authentication Flow & Session Guardrails
TruEd strictly enforces standard tokenless identity creation through phone-based OTP sessions to simplify rural student onboarding.

[Client Phone Submission] ──➔ [OtpSession Service] ──➔ [Bcrypt Hash] ──➔ [Save to OtpSession Node]
│ (TTL Auto-Destruct 10m)
▼
[Auth Access Granted]     鈼€── [Verify sessionToken] 鈼€── [Match Input OTP] 鈼€── [Check LockedUntil Flag]


1. **OTP Generation & Security Sandboxing:**
   * When a user requests entry, the system verifies `countRecentSends()` over a rolling 1-hour window (`windowMs = 3600000`). If requests cross 5 hits, the route handler must reject the execution to prevent gateway financial depletion.
   * A clean 4-to-6 digit token is generated, plaintext is passed directly to the `SMS/Email Gateway`, and a secure cryptographic string (`otpHash`) is prepared via `bcryptjs`.
   * A fresh transaction entry is written to `OtpSession` with a strict execution timeframe: `expiresAt = Date.now() + 10 minutes`. MongoDB's background daemon instantly purges this record once the timestamp expires.

2. **The Verification & Lockout Sequence:**
   * Before parsing checking loops, the service layer invokes `otpSession.isLocked()`. If current execution time satisfies `lockedUntil > Date.now()`, the client is blocked instantly with a `423 Locked` state through the `ApiError` utility.
   * If input does not match the protected `otpHash`, `incrementAttempt()` fires. Upon crossing the 5th consecutive execution breach, `lockedUntil` automatically updates to a firm 15-minute freeze (`Date.now() + 15 * 60 * 1000`).
   * Upon structural confirmation, an isolated `sessionToken` maps to the profile, `markVerified()` triggers, and the auth controller issues a signed JSON Web Token (`jsonwebtoken`) to freeze the active handshake session. The single-use vector instantly fires `consumeSessionToken()` to prevent token reuse attacks.

---

### B. The Append-Only KYC & Live Instructor Sync Engine
To protect the platform from operational liability, instructors are sandboxed inside a strict compliance verification cycle before their profile joins the global marketplace text indexes.

[Teacher Multi-Part Upload] ──➔ [Local Node Cache] ──➔ [Cloudinary Ship] ──➔ [Unlink Local File Temp]
│
▼
[User.kycStatus 藴 APPROVED] 鈼€── [Document.approve()] 鈼€── [Admin Audit Review] ──➔ [Document Node Appended]


1. **The Media Ingestion Protocol:**
   * Multi-part requests capture credentials directly onto local ephemeral storage nodes.
   * The interceptor ships files directly to Cloudinary using `uploadOnCloudinary()`. The routine executes a structural `fs.unlink(localFilePath)` wrap inside a final logic block—ensuring that whether the network call fails or passes, storage volumes are instantly cleaned up.

2. **Immutable Document Auditing & Auto-Deactivation:**
   * Instructors cannot directly modify fields inside their identity tracker data matrices. Re-uploads register as an entirely unique document node containing an incremental version parameter (`version++`).
   * A built-in database pre-save trigger identifies duplicate structural categories:
     ```javascript
     await this.constructor.updateMany({ teacherId: this.teacherId, type: this.type, _id: { $ne: this._id }, isActive: true }, { $set: { isActive: false } });
     ```
     This instantly shifts obsolete profiles out of scope without removing the file trace, preserving old paperwork audit histories.

3. **Cross-Collection Operational Sync:**
   * Administrative agents interact through `document.approve(adminId, note)`. The action marks the index flag `isActive: true` and logs standard compliance indicators.
   * The system evaluates `Document.isKycComplete(teacherId)` to check for approved matches covering `identity_proof` and `degree`. Once satisfied, the `TeacherProfile.pre('save')` automation loop triggers an asynchronous update to the root collection:
     ```javascript
     this.model('User').updateOne({ _id: this.userId }, { kycStatus: 'approved' });
     ```
     This denormalized setup enables routing logic to evaluate operational states directly from `req.user.kycStatus` without running costly across-table database lookups (`.populate()`) on every endpoint hit.

---

### C. The Double-Booking Prevention & Snapshot Scheduler
The scheduling registry operates as a synchronized transaction engine mapping consumer allocations directly against an instructor's available blocks.

[Booking Request Initialized] ──➔ [Validate Teacher.isAvailable] ──➔ [Invoke Booking.hasConflict()]
│
▼
[Slot Sealed for Checkout] 鈼€── [Mark Profile Slot isBooked: true] 鈼€── [Confirm Slot Availability]


1. **Temporal Conflict Checking Architecture:**
   * When a client initiates checkout, the routing engine enforces check constraints across time zones using `Booking.hasConflict()`.
   * The analytical matcher uses an explicit boundary evaluation formula running inside the Mongo cluster:
     ```javascript
     { $add: ['$scheduledAt', { $multiply: ['$durationMinutes', 60000] }] } > scheduledAt
     ```
     This query catches overlapping times by scanning all matches within `PENDING`, `CONFIRMED`, or `IN_PROGRESS` slots. Even if a payment is currently processing, the target window is completely locked, eliminating simultaneous checkout conflicts.

2. **State Transition Validation Maps:**
   * System entities update through an enforced state validation object (`VALID_TRANSITIONS`). Lifecycle changes must query `canTransitionTo(newStatus)` before execution:
     ```javascript
     const VALID_TRANSITIONS = {
       pending:     ['confirmed', 'cancelled'],
       confirmed:   ['in_progress', 'cancelled'],
       in_progress: ['completed', 'disputed']
     };
     ```
   * Any out-of-order state mutations throw an absolute operational rejection through `ApiError`, preventing users from artificially forcing unauthorized updates (e.g., trying to cancel a session that is already complete).

---

### D. The Inbound Ledger & Escrow Settlement Protocol
TruEd maintains an internal ledger system to manage marketplace funds securely across multi-party transaction cycles.

[Razorpay Payment Success] ──➔ [logWebhookEvent()] ──➔ [payment.capture()] ──➔ [Lock Capital in Escrow]
│
▼
[Payout Worker Queue] 鈼€── [payment.releaseEscrow()] 鈼€── [booking.endSession()] 鈼€── [Class Complete Trigger]


1. **Webhook Processing & Idempotency Safeguards:**
   * Inbound event payloads from payment gateway partners route through transactional endpoints and register directly using `logWebhookEvent()`.
   * To prevent duplicate processing errors from duplicate network retries, handlers evaluate incoming payloads against a unique index constraint (`idempotencyKey`). If the identifier matches an existing record, the system returns an immediate `200 OK` success block without running duplicate account adjustments.

2. **The Escrow Lifecycle Allocation:**
   * Upon verifying signature arguments, the application invokes `payment.capture()`. This updates the internal tracking metrics to `status: PAYMENT_STATUS.CAPTURED` and sets `escrowStatus: ESCROW_STATUS.HOLDING`.
   * Financial allocations split inside automated tracking rules using integer precision:
     ```javascript
     this.commissionPaise = Math.round(this.totalAmountPaise * platformFeePercent / 100);
     this.teacherPayoutPaise = this.totalAmountPaise - this.commissionPaise;
     ```
   * Capital remains securely locked in this state until a teacher logs class termination through `booking.endSession()`. This triggers an automatic update to the financial record via `payment.releaseEscrow()`, shifting the capital directly into the outgoing settlement pool.

---

### E. Outbound Payout Automation & Automated Fault Tolerance
Settling marketplace earnings requires specialized fault-isolation networks to handle downstream banking connectivity drops gracefully.

[Escrow Released into Pool] ──➔ [Payout Row Queued] ──➔ [Worker Node Execution] ──➔ [RazorpayX API Handshake]
│
▼
[Exponential Backoff Delay] 鈼€── [markFailed()] 鈼€── [Log Error Trace] 鈼€── [Network Connection Drop]


1. **The Automated Settlement Queue:**
   * Automated cron nodes systematically scan the ledger using `Payout.processingQueue(batchSize)`. The criteria isolate entries matching `status: 'queued', onHold: false`, running processing pipelines concurrently across targeted worker threads.
   * If an account encounters operational errors during execution, handlers call `markFailed(reason)`. This logs the trace and updates retry parameters to manage downstream network issues gracefully.

2. **Exponential Backoff Calculations:**
   * Rather than flooding api channels with consecutive retry attempts during bank outages, failed records dynamically calculate delayed retry processing times via progressive minute increments:
     ```javascript
     const backoffs = [15, 60, 240, 720, 1440]; // 15m, 1h, 4h, 12h, 24h intervals
     this.nextRetryAt = new Date(Date.now() + delay * 60 * 1000);
     ```
   * Cron workers entirely bypass active execution targets until `Date.now() >= nextRetryAt`. Upon crossing the 5th sequential threshold, scheduling chains terminate automatically, and the item shifts to a static error state for manual administrative support review.

---

### F. SLA-Driven Dispute Resolution & Claims Pipelines
When a consumer files a grievance (e.g., reporting an instructor no-show), the platform isolates the transaction inside an audited claims flow.

[Dispute Filed by Student] ──➔ [Lock Booking/Payment Status] ──➔ [Auto-Calculate 72-Hour slaDeadline]
│
▼
[Payment.addRefund() Pipeline] 鈼€── [refundRequest.approve()] 鈼€── [Admin Resolution Decision]


1. **Grievance Logging & Fraud Lockouts:**
   * When a claim is submitted, the framework instantly updates the parent session marker to `BOOKING_STATUS.DISPUTED`, locking the transaction row to prevent instructors from executing manual settlement pulls while an investigation is active.
   * To prevent users from spamming the system with duplicate claims for the same event, the engine enforces strict unique index locks:
     ```javascript
     refundRequestSchema.index({ bookingId: 1 }, { unique: true, partialFilterExpression: { status: 'requested' } });
     ```

2. **Compliance Target Tracking (SLA Deadlines):**
   * Upon creation, the document automatically logs a fixed resolution window: `slaDeadline = Date.now() + 72 hours`.
   * Management monitors operational compliance by checking unresolved items against the target timeframe using `RefundRequest.slaBreaches()`. This allows dashboards to flag overdue tasks immediately before they breach service agreements.
   * When an administrator resolves the case via `refundRequest.approve()`, the system calculates the final processing time (`resolutionTimeHours = resolvedAt - createdAt`), feeding clean operational analytics metrics directly back into the platform's reporting boards.