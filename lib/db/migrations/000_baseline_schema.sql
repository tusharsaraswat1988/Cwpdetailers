DO $$ BEGIN
  CREATE TYPE "public"."service_task_type" AS ENUM('daily_cleaning', 'car_wash', 'solar_cleaning', 'interior_detailing', 'one_time_service');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."contract_asset_type" AS ENUM('vehicle', 'solar_site', 'customer');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."contract_fulfillment_type" AS ENUM('one_time', 'contract_recurring', 'contract_credits');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."contract_product_line" AS ENUM('daily_cleaning', 'wash_package', 'monthly_wash', 'solar_amc', 'detailing_plan', 'one_time_service');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."contract_registry_status" AS ENUM('active', 'paused', 'completed', 'expired', 'cancelled', 'expiring');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."contract_source_system" AS ENUM('dcms', 'entitlement', 'subscription', 'booking');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."service_assignment_status" AS ENUM('pending', 'assigned', 'ready_for_execution', 'removed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."assignment_timeline_event_type" AS ENUM('ASSIGNMENT_CREATED', 'ASSIGNMENT_CHANGED', 'ASSIGNMENT_REMOVED', 'READY_FOR_EXECUTION', 'NOTE_ADDED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."job_ops_status" AS ENUM('in_field', 'pending_quality_review', 'reopened', 'approved', 'ready_for_billing', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."job_priority" AS ENUM('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."service_execution_location_event" AS ENUM('check_in', 'check_out', 'gps_ping');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."service_execution_note_kind" AS ENUM('technician', 'customer', 'internal');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."service_execution_photo_kind" AS ENUM('before', 'after', 'proof', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."service_execution_status" AS ENUM('scheduled', 'ready_for_execution', 'started', 'paused', 'resumed', 'completed', 'missed', 'cancelled', 'rescheduled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."execution_timeline_event_type" AS ENUM('EXECUTION_READY', 'EXECUTION_STARTED', 'EXECUTION_PAUSED', 'EXECUTION_RESUMED', 'EXECUTION_COMPLETED', 'EXECUTION_CANCELLED', 'BEFORE_PHOTOS_UPLOADED', 'AFTER_PHOTOS_UPLOADED', 'CHECKLIST_UPDATED', 'CHECKLIST_COMPLETED', 'NOTE_ADDED', 'SIGNATURE_CAPTURED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."job_orchestration_timeline_event_type" AS ENUM('JOB_ENTERED_QUALITY_REVIEW', 'JOB_REOPENED', 'JOB_ESCALATED', 'JOB_DE_ESCALATED', 'JOB_PRIORITY_CHANGED', 'JOB_APPROVED', 'JOB_READY_FOR_BILLING', 'JOB_CANCELLED', 'JOB_OWNERSHIP_CHANGED', 'JOB_DEPENDENCY_SET', 'JOB_DEPENDENCY_CLEARED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."billing_commercial_timeline_event_type" AS ENUM('COMMERCIAL_PREVIEWED', 'INVOICE_DRAFT_CREATED', 'INVOICE_ISSUED', 'INVOICE_PAYMENT_PENDING', 'INVOICE_PAID', 'INVOICE_VOIDED', 'INVOICE_CANCELLED', 'CREDIT_NOTE_CREATED', 'ENTITLEMENT_CONSUMED', 'COMMERCIAL_CLOSED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."user_role" AS ENUM('customer', 'staff', 'admin', 'superadmin', 'central_admin', 'city_admin', 'branch_manager', 'supervisor', 'franchisee', 'manager');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."customer_status" AS ENUM('active', 'inactive', 'suspended');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."vehicle_type" AS ENUM('sedan', 'suv', 'hatchback', 'luxury', 'van', 'truck');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."entitlement_status" AS ENUM('active', 'expired', 'exhausted', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."entitlement_type" AS ENUM('wash_credit', 'cleaning_credit', 'solar_visit', 'detailing_credit', 'generic');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."pricing_model" AS ENUM('fixed', 'vehicle_matrix', 'solar_slab');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."pricing_type" AS ENUM('inclusive', 'exclusive');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."service_status" AS ENUM('active', 'disabled', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."solar_pricing_term" AS ENUM('one_time', 'amc_6', 'amc_12');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."assignment_strategy" AS ENUM('manual', 'auto', 'round_robin');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."service_category" AS ENUM('car_wash', 'detailing', 'ceramic_coating', 'ppf', 'interior', 'solar_cleaning', 'amc', 'subscription');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."subscription_status" AS ENUM('active', 'paused', 'expiring', 'expired', 'cancelled', 'pending', 'missed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."subscription_type" AS ENUM('monthly_wash', 'solar_amc', 'detailing_plan');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."staff_availability" AS ENUM('available', 'unavailable');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."staff_category" AS ENUM('supervisor', 'cleaning_staff');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."staff_employment_type" AS ENUM('salaried', 'per_job', 'hybrid');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."staff_gender" AS ENUM('male', 'female', 'other', 'prefer_not_to_say');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."staff_petrol_model" AS ENUM('included', 'per_km');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."staff_role" AS ENUM('technician', 'supervisor', 'driver', 'solar_technician');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."staff_vehicle_type" AS ENUM('two_wheeler', 'three_wheeler', 'four_wheeler', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."staff_verification_status" AS ENUM('pending', 'verified', 'rejected', 'suspended');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."staff_document_type" AS ENUM('aadhaar', 'pan', 'driving_license', 'address_proof', 'bank_cancelled_cheque', 'bank_passbook', 'staff_consent_form', 'vehicle_insurance', 'vehicle_registration', 'police_verification', 'medical_certificate', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."staff_skill_level" AS ENUM('trainee', 'basic', 'intermediate', 'expert');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."booking_service_type" AS ENUM('car_wash', 'detailing', 'solar_cleaning', 'one_time_wash', 'daily_cleaning', 'subscription_wash', 'pickup_drop', 'emergency');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."booking_status" AS ENUM('draft', 'scheduled', 'confirmed', 'waiting_assignment', 'assigned', 'in_progress', 'completed', 'missed', 'rescheduled', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."booking_type" AS ENUM('one_time', 'subscription_visit', 'contract_visit', 'inspection', 'follow_up', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."makeup_approval_status" AS ENUM('pending', 'approved', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."attendance_status" AS ENUM('present', 'absent', 'late', 'half_day');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."complaint_priority" AS ENUM('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."complaint_status" AS ENUM('open', 'assigned', 'in_progress', 'awaiting_customer', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."complaint_type" AS ENUM('quality', 'delay', 'reclean', 'damage', 'billing', 'subscription', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."invoice_billing_mode" AS ENUM('subscription_visit', 'one_time', 'prepaid_fulfillment', 'manual');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."invoice_commercial_status" AS ENUM('draft', 'issued', 'payment_pending', 'paid', 'commercially_closed', 'voided');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."invoice_document_type" AS ENUM('tax_invoice', 'credit_note', 'debit_note');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."payment_method" AS ENUM('cash', 'upi', 'card', 'bank_transfer', 'wallet', 'razorpay', 'cashfree');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."payment_status" AS ENUM('pending', 'completed', 'failed', 'refunded', 'reversed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."quotation_status" AS ENUM('draft', 'sent', 'accepted', 'rejected', 'converted');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."expense_category" AS ENUM('chemicals', 'fuel', 'salary', 'rent', 'maintenance', 'misc');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'whatsapp', 'email', 'sms');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."notification_delivery_status" AS ENUM('pending', 'sent', 'failed', 'skipped');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."notification_type" AS ENUM('booking_confirmation', 'payment_reminder', 'subscription_expiry', 'service_complete', 'complaint_update', 'broadcast', 'payment_initiated', 'payment_success', 'payment_failed', 'subscription_activated', 'subscription_paused', 'subscription_resumed', 'subscription_cancelled', 'subscription_renewal_due', 'cleaning_completed', 'cleaning_cna', 'cleaning_missed', 'exception_resolved', 'ticket_created', 'ticket_updated', 'ticket_resolved', 'staff_assigned', 'technician_en_route', 'service_started', 'staff_reassigned', 'schedule_changed', 'assignment_cancelled', 'makeup_booking_confirmed', 'assignment_failure', 'repeated_execution_failure', 'reschedule_approval_required', 'general');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."franchisee_status" AS ENUM('active', 'inactive', 'terminated', 'pending', 'onboarding', 'suspended');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."lead_lost_reason" AS ENUM('too_expensive', 'not_interested', 'no_response', 'chose_competitor', 'location_issue', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."lead_service_interest" AS ENUM('one_time_wash', 'detailing', 'daily_cleaning', 'solar', 'accessories');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."lead_source" AS ENUM('whatsapp', 'instagram', 'facebook', 'website', 'call', 'google', 'walk_in', 'referral');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'interested', 'quotation', 'booked', 'completed', 'subscription', 'lost');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."lead_activity_type" AS ENUM('note', 'call', 'whatsapp', 'email', 'status_change', 'follow_up_scheduled', 'converted');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."booking_event_type" AS ENUM('status_change', 'proof_upload', 'reassign', 'reschedule', 'cancel', 'note');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."booking_snapshot_type" AS ENUM('ADDRESS', 'LOCATION', 'COVERAGE', 'PRICE', 'STAFF', 'VEHICLE', 'COUPON');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."booking_timeline_event_type" AS ENUM('BOOKING_CREATED', 'COVERAGE_VALIDATED', 'ADDRESS_SNAPSHOT_CREATED', 'PRICE_CALCULATED', 'BOOKING_VALIDATED', 'BOOKING_CONFIRMED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'ASSIGNED', 'ACCEPTED', 'TRAVELLING', 'ARRIVED', 'STARTED', 'PAUSED', 'RESUMED', 'COMPLETED', 'CANCELLED', 'FAILED', 'REVIEW_PENDING', 'REVIEWED', 'ARCHIVED', 'ADDRESS_CHANGED', 'RESCHEDULED', 'PROOF_UPLOADED', 'BUSINESS_RULE_EVALUATED', 'SERVICE_DISCOVERED', 'WAITING_ASSIGNMENT');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."system_job_status" AS ENUM('pending', 'running', 'success', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."wallet_payment_mode" AS ENUM('cash', 'upi', 'bank_transfer', 'adjustment');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."wallet_transaction_type" AS ENUM('credit', 'debit');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."audience_filter_type" AS ENUM('all_customers', 'active_customers', 'inactive_customers', 'lost_leads', 'open_leads', 'hot_leads', 'warm_leads', 'cold_leads', 'cwp_customers', 'dcc_customers', 'solar_customers', 'bidwar_customers', 'payment_due', 'wash_due', 'amc_due', 'expiring_package', 'no_visit_since_days', 'multiple_vehicles', 'high_value_customers', 'revenue_above', 'last_visit_between');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_automation_trigger" AS ENUM('payment_due', 'wash_due', 'package_expiry', 'birthday', 'lead_follow_up', 'invoice_generated', 'payment_received', 'amc_reminder');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_campaign_recurrence" AS ENUM('none', 'daily', 'weekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_campaign_status" AS ENUM('draft', 'scheduled', 'processing', 'sent', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_channel" AS ENUM('sms', 'whatsapp', 'email', 'push', 'in_app');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_event_status" AS ENUM('pending', 'queued', 'processing', 'sent', 'delivered', 'read', 'failed', 'skipped', 'clicked', 'converted', 'consent_blocked', 'retrying', 'dead_letter');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_provider_type" AS ENUM('fast2sms', 'msg91', 'twilio', 'resend', 'smtp', 'firebase', 'whatsapp_business');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_consent_source" AS ENUM('walk_in', 'website', 'lead_form', 'invoice', 'manual', 'import');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."dlt_template_category" AS ENUM('transactional', 'promotional', 'service_implicit', 'otp', 'utility');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_ai_recommendation_type" AS ENUM('best_send_time', 'campaign_suggestion', 'segment_suggestion', 'reactivation');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_automation_run_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_automation_step_type" AS ENUM('send_sms', 'send_whatsapp', 'send_email', 'send_push', 'create_task', 'assign_staff', 'wait', 'branch');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_brand_status" AS ENUM('active', 'inactive', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_delivery_status" AS ENUM('queued', 'processing', 'sent', 'delivered', 'read', 'failed', 'retrying', 'dead_letter');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_dlt_template_status" AS ENUM('draft', 'pending_approval', 'approved', 'rejected', 'suspended');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_email_type" AS ENUM('marketing', 'transactional', 'service');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_queue_name" AS ENUM('sms_queue', 'whatsapp_queue', 'email_queue', 'push_queue');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_whatsapp_approval_status" AS ENUM('draft', 'pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_whatsapp_category" AS ENUM('marketing', 'utility', 'authentication');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_workflow_trigger" AS ENUM('lead_created', 'lead_lost', 'lead_won', 'customer_registered', 'package_purchased', 'invoice_generated', 'payment_received', 'payment_due', 'wash_due', 'solar_cleaning_due', 'amc_due', 'package_expiry', 'no_visit_30_days', 'no_visit_60_days', 'no_visit_90_days', 'birthday', 'anniversary');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_conversation_status" AS ENUM('open', 'assigned', 'pending', 'resolved', 'closed', 'spam');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_journey_event_type" AS ENUM('lead_created', 'lead_assigned', 'lead_won', 'lead_lost', 'sms_sent', 'sms_received', 'whatsapp_sent', 'whatsapp_delivered', 'whatsapp_read', 'whatsapp_replied', 'email_sent', 'email_opened', 'email_replied', 'push_sent', 'in_app_sent', 'booking_created', 'invoice_generated', 'payment_received', 'package_purchased', 'service_completed', 'review_submitted', 'conversation_opened', 'conversation_closed', 'ticket_created', 'csat_submitted', 'link_clicked', 'campaign_converted', 'customer_reactivated');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_kb_category" AS ENUM('faq', 'policy', 'script', 'response_template');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_message_delivery" AS ENUM('pending', 'sent', 'delivered', 'read', 'replied', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_message_direction" AS ENUM('incoming', 'outgoing');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_sla_status" AS ENUM('within_sla', 'warning', 'breached');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_tag_source" AS ENUM('auto', 'manual');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."comm_ticket_rule_trigger" AS ENUM('complaint_detected', 'payment_issue', 'escalation_request', 'sla_breach');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."legal_page_status" AS ENUM('draft', 'published');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."city_status" AS ENUM('draft', 'setup_in_progress', 'ready_for_launch', 'active', 'suspended', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."address_identity_status" AS ENUM('ACTIVE', 'MERGED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."address_snapshot_reason" AS ENUM('BOOKING', 'CONTRACT', 'MANUAL', 'MIGRATION', 'API');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."address_source" AS ENUM('GOOGLE', 'GPS', 'MANUAL', 'IMPORTED', 'ADMIN', 'API');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."address_type" AS ENUM('HOME', 'WORK', 'OTHER', 'FAMILY', 'OFFICE', 'SITE', 'WAREHOUSE', 'FACTORY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."address_verification_status" AS ENUM('UNKNOWN', 'GOOGLE_VERIFIED', 'GPS_VERIFIED', 'USER_ENTERED', 'ADMIN_VERIFIED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."service_location_status" AS ENUM('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."service_location_type" AS ENUM('office', 'factory', 'residence', 'parking', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."asset_status" AS ENUM('active', 'inactive', 'retired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."asset_type" AS ENUM('vehicle', 'solar_site');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."customer_asset_link_type" AS ENUM('operational', 'commercial', 'historical');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."migration_batch_status" AS ENUM('preview', 'dry_run', 'committed', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."migration_entity_type" AS ENUM('customer', 'user', 'vehicle', 'solar_site', 'subscription', 'entitlement');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."migration_row_status" AS ENUM('success', 'error', 'skipped', 'warning');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."dcms_exception_status" AS ENUM('open', 'investigating', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."dcms_exception_type" AS ENUM('car_not_available', 'vehicle_moved_bay', 'gate_access_denied', 'staff_unavailable', 'missed_cleaning', 'customer_complaint', 'reclean_requested', 'basement_gps_audit');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."dcms_notification_event_type" AS ENUM('visit_completed', 'visit_rejected', 'subscription_paused', 'subscription_resumed', 'renewal_eligible', 'missed_visit', 'vehicle_assigned', 'route_updated', 'daily_route_available', 'feedback_requested', 'fraud_alert', 'negative_feedback', 'renewal_opportunity', 'high_missed_visits');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."dcms_pause_action" AS ENUM('pause', 'resume', 'pause_requested', 'pause_approved', 'pause_rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."dcms_pause_approval_status" AS ENUM('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."dcms_subscription_status" AS ENUM('pending_payment', 'active', 'paused', 'completed', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."dcms_subscription_type" AS ENUM('daily_cleaning', 'solar_amc', 'housekeeping', 'driver_service', 'security_service');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."dcms_visit_status" AS ENUM('completed', 'rejected', 'car_not_available');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."dcms_visit_type" AS ENUM('cleaning', 'wash');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."extra_service_commercial_source" AS ENUM('DCC_INCLUDED', 'PAID_EXTRA');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."extra_service_request_status" AS ENUM('pending_customer_approval', 'customer_approved', 'otp_verified', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."extra_service_request_type" AS ENUM('extra_car_wash');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."staff_location_action" AS ENUM('attendance', 'en_route', 'job_start', 'job_complete');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."staff_payout_status" AS ENUM('draft', 'approved', 'disbursed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "customer_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"asset_type" "contract_asset_type",
	"asset_id" integer,
	"service_location_id" integer,
	"registry_asset_id" integer,
	"service_id" integer,
	"contract_type" "contract_fulfillment_type",
	"catalog_ref_kind" text,
	"catalog_ref_id" integer,
	"product_line" "contract_product_line" NOT NULL,
	"source_system" "contract_source_system" NOT NULL,
	"source_id" integer NOT NULL,
	"status" "contract_registry_status" DEFAULT 'active' NOT NULL,
	"valid_from" date,
	"valid_until" date,
	"summary_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"company_id" integer,
	"franchisee_id" integer,
	"branch_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pending_service_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_registry_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"service_location_id" integer,
	"asset_id" integer,
	"service_id" integer,
	"source_system" "contract_source_system" NOT NULL,
	"source_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"company_id" integer,
	"franchisee_id" integer,
	"branch_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "service_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"pending_assignment_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"service_location_id" integer,
	"asset_id" integer,
	"contract_id" integer NOT NULL,
	"service_id" integer,
	"booking_id" integer,
	"assigned_staff_id" integer NOT NULL,
	"task_type" "service_task_type" DEFAULT 'one_time_service' NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"status" "service_assignment_status" DEFAULT 'assigned' NOT NULL,
	"service_label" text,
	"product_line" text,
	"notes" text,
	"company_id" integer,
	"franchisee_id" integer,
	"branch_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "assignment_timeline" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"pending_assignment_id" integer,
	"event_type" "assignment_timeline_event_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"from_staff_id" integer,
	"to_staff_id" integer,
	"actor_id" integer,
	"actor_name" text,
	"notes" text,
	"metadata" json DEFAULT '{}'::json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "service_execution_checklist_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"execution_id" integer NOT NULL,
	"label" text NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "service_execution_location_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"execution_id" integer NOT NULL,
	"event_type" "service_execution_location_event" DEFAULT 'gps_ping' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"accuracy" double precision,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "service_execution_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"execution_id" integer NOT NULL,
	"kind" "service_execution_note_kind" DEFAULT 'technician' NOT NULL,
	"body" text NOT NULL,
	"author_staff_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "service_execution_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"execution_id" integer NOT NULL,
	"kind" "service_execution_photo_kind" DEFAULT 'proof' NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"latitude" double precision,
	"longitude" double precision,
	"accuracy" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "service_executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_assignment_id" integer,
	"contract_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"service_location_id" integer,
	"asset_id" integer,
	"assigned_staff_id" integer NOT NULL,
	"task_type" "service_task_type" DEFAULT 'one_time_service' NOT NULL,
	"is_substitute" boolean DEFAULT false NOT NULL,
	"substitute_for_staff_id" integer,
	"scheduled_date" date NOT NULL,
	"scheduled_time" text,
	"status" "service_execution_status" DEFAULT 'ready_for_execution' NOT NULL,
	"en_route_at" timestamp,
	"started_at" timestamp,
	"paused_at" timestamp,
	"resumed_at" timestamp,
	"completed_at" timestamp,
	"estimated_arrival_at" timestamp,
	"eta_minutes" integer,
	"last_location_update_at" timestamp,
	"customer_signature_url" text,
	"customer_signed_at" timestamp,
	"cancellation_reason" text,
	"rescheduled_from_id" integer,
	"ops_status" "job_ops_status" DEFAULT 'in_field' NOT NULL,
	"priority" "job_priority" DEFAULT 'normal' NOT NULL,
	"depends_on_execution_id" integer,
	"is_escalated" boolean DEFAULT false NOT NULL,
	"escalation_reason" text,
	"escalated_at" timestamp,
	"escalated_by" integer,
	"ops_owner_user_id" integer,
	"quality_review_started_at" timestamp,
	"approved_at" timestamp,
	"approved_by" integer,
	"ready_for_billing_at" timestamp,
	"reopened_at" timestamp,
	"reopen_reason" text,
	"ops_cancelled_at" timestamp,
	"ops_cancel_reason" text,
	"legacy_booking_id" integer,
	"legacy_dcms_visit_id" integer,
	"company_id" integer,
	"franchisee_id" integer,
	"branch_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "execution_timeline" (
	"id" serial PRIMARY KEY NOT NULL,
	"execution_id" integer NOT NULL,
	"event_type" "execution_timeline_event_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"actor_id" integer,
	"actor_name" text,
	"metadata" json DEFAULT '{}'::json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "job_orchestration_timeline" (
	"id" serial PRIMARY KEY NOT NULL,
	"execution_id" integer NOT NULL,
	"event_type" "job_orchestration_timeline_event_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"actor_id" integer,
	"actor_name" text,
	"metadata" json DEFAULT '{}'::json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "billing_commercial_timeline" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer,
	"execution_id" integer,
	"event_type" "billing_commercial_timeline_event_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"actor_id" integer,
	"actor_name" text,
	"metadata" json DEFAULT '{}'::json,
	"company_id" integer,
	"franchisee_id" integer,
	"branch_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"gstin" text,
	"address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"password_hash" text,
	"google_id" text,
	"avatar_url" text,
	"auth_provider" text DEFAULT 'local' NOT NULL,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"company_id" integer,
	"city_id" integer,
	"branch_id" integer,
	"franchisee_id" integer,
	"staff_id" integer,
	"customer_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);

CREATE TABLE IF NOT EXISTS "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);

CREATE TABLE IF NOT EXISTS "auth_pending_google" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"google_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"portal" text DEFAULT 'customer' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_pending_google_token_hash_unique" UNIQUE("token_hash")
);

CREATE TABLE IF NOT EXISTS "password_reset_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code_hash" text NOT NULL,
	"channel" text DEFAULT 'sms' NOT NULL,
	"portal" text DEFAULT 'customer' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "auth_otp_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"purpose" text NOT NULL,
	"portal" text DEFAULT 'customer' NOT NULL,
	"pending_name" text,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "permission_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"role" text,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"allow" boolean NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"allow" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "branch_user_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"assignment_role" text DEFAULT 'branch_manager' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"assigned_by" integer,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_until" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revocation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "branches" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"city" text NOT NULL,
	"city_id" integer,
	"address" text,
	"phone" text,
	"manager_name" text,
	"company_id" integer,
	"franchisee_id" integer,
	"legal_entity_id" integer,
	"is_company_operated" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"service_availability" json,
	"operational_notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "service_branch_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"base_price_override" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"custom_settings" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"address" text,
	"city" text,
	"city_id" integer,
	"status" "customer_status" DEFAULT 'active' NOT NULL,
	"wallet_balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_dues" numeric(10, 2) DEFAULT '0' NOT NULL,
	"photo_url" text,
	"last_payment_date" date,
	"customer_since" date,
	"historical_wash_count" integer,
	"historical_solar_visit_count" integer,
	"operational_notes" text,
	"company_id" integer,
	"franchisee_id" integer,
	"branch_id" integer,
	"gstin" text,
	"billing_name" text,
	"referred_by_customer_id" integer,
	"referral_code" text,
	"loyalty_points_balance" integer DEFAULT 0 NOT NULL,
	"legacy_segment" text,
	"reactivated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_referral_code_unique" UNIQUE("referral_code")
);

CREATE TABLE IF NOT EXISTS "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"vehicle_model_id" integer,
	"seat_category_id" integer,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"year" integer,
	"color" text,
	"registration_number" text NOT NULL,
	"registration_normalized" text,
	"vehicle_type" "vehicle_type" DEFAULT 'sedan',
	"service_address" text,
	"service_lat" double precision,
	"service_lng" double precision,
	"place_id" text,
	"location_label" text,
	"location_complete" boolean DEFAULT false NOT NULL,
	"company_id" integer,
	"franchisee_id" integer,
	"branch_id" integer,
	"assigned_staff_id" integer,
	"ref_photo_front_url" text,
	"ref_photo_rear_url" text,
	"ref_photo_left_url" text,
	"ref_photo_right_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "solar_sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"address" text NOT NULL,
	"city" text,
	"panel_count" integer NOT NULL,
	"site_name" text,
	"notes" text,
	"panel_capacity_kw" numeric(8, 2),
	"installation_date" date,
	"last_cleaned_date" date,
	"next_service_date" date,
	"service_lat" double precision,
	"service_lng" double precision,
	"place_id" text,
	"location_label" text,
	"location_complete" boolean DEFAULT false NOT NULL,
	"company_id" integer,
	"franchisee_id" integer,
	"branch_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "catalog_package_addons" (
	"id" serial PRIMARY KEY NOT NULL,
	"package_id" integer NOT NULL,
	"addon_id" integer NOT NULL,
	"extra_price" numeric(10, 2),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "catalog_package_entitlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"package_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"entitlement_type" "entitlement_type" NOT NULL,
	"credit_count" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "catalog_packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"short_description" text,
	"service_category_id" integer,
	"city_id" integer,
	"price" numeric(10, 2) NOT NULL,
	"gst_rate" numeric(5, 2) DEFAULT '18' NOT NULL,
	"pricing_type" "pricing_type" DEFAULT 'inclusive' NOT NULL,
	"solar_term" "solar_pricing_term",
	"validity_days" integer DEFAULT 30 NOT NULL,
	"off_days" json DEFAULT '[]'::json,
	"tag" text,
	"is_highlighted" boolean DEFAULT false NOT NULL,
	"show_on_homepage" boolean DEFAULT false NOT NULL,
	"features" json DEFAULT '[]'::json,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "service_status" DEFAULT 'active' NOT NULL,
	"branch_id" integer,
	"service_id" integer,
	"package_type" text DEFAULT 'recurring_monthly',
	"included_visits" integer DEFAULT 1,
	"complimentary_visits" integer DEFAULT 0,
	"service_frequency" text DEFAULT 'daily',
	"vehicle_category_ids" json DEFAULT '[]'::json,
	"terms_and_conditions" text,
	"effective_from" timestamp with time zone,
	"effective_until" timestamp with time zone,
	"is_renewal_eligible" boolean DEFAULT true,
	"renewal_discount_percent" numeric(5, 2) DEFAULT '0',
	"version" integer DEFAULT 1 NOT NULL,
	"metadata" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_packages_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "catalog_reminder_hooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"hook_key" text NOT NULL,
	"description" text,
	"trigger_days" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"config" json DEFAULT '{}'::json,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_reminder_hooks_hook_key_unique" UNIQUE("hook_key")
);

CREATE TABLE IF NOT EXISTS "catalog_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" json NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_settings_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "customer_entitlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"package_id" integer,
	"subscription_id" integer,
	"service_id" integer NOT NULL,
	"service_location_id" integer,
	"asset_id" integer,
	"vehicle_id" integer,
	"solar_site_id" integer,
	"city_id" integer,
	"entitlement_type" "entitlement_type" NOT NULL,
	"total_credits" integer NOT NULL,
	"used_credits" integer DEFAULT 0 NOT NULL,
	"remaining_credits" integer NOT NULL,
	"valid_from" date NOT NULL,
	"valid_until" date NOT NULL,
	"status" "entitlement_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "entitlement_consumption_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entitlement_id" integer NOT NULL,
	"booking_id" integer,
	"credits_consumed" integer DEFAULT 1 NOT NULL,
	"consumed_at" timestamp DEFAULT now() NOT NULL,
	"reverted_at" timestamp
);

CREATE TABLE IF NOT EXISTS "service_addon_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"addon_id" integer NOT NULL,
	"service_id" integer,
	"service_category_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "service_addons" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"base_price" numeric(10, 2) NOT NULL,
	"gst_rate" numeric(5, 2) DEFAULT '18' NOT NULL,
	"pricing_type" "pricing_type" DEFAULT 'inclusive' NOT NULL,
	"duration_minutes" integer,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_addons_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "service_availability_matrix" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"city_id" integer NOT NULL,
	"branch_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"booking_modes" json DEFAULT '["one_time"]'::json,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_until" timestamp with time zone,
	"base_price_override" numeric(10, 2),
	"package_config_id" integer,
	"operational_constraints" json DEFAULT '{}'::json,
	"admin_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "service_city_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"city_id" integer NOT NULL,
	"base_price_override" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "service_city_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"city_id" integer NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"seo_keywords" text,
	"og_image_url" text,
	"schema_data" json,
	"short_description" text,
	"long_description" text,
	"benefits" json,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "solar_pricing_slabs" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"package_id" integer,
	"city_id" integer,
	"term" "solar_pricing_term" DEFAULT 'one_time' NOT NULL,
	"min_panels" integer DEFAULT 1 NOT NULL,
	"max_panels" integer,
	"price_per_panel" numeric(10, 2),
	"minimum_billing" numeric(10, 2) DEFAULT '0' NOT NULL,
	"requires_site_visit" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"description" text,
	"short_description" text,
	"long_description" text,
	"service_category_id" integer,
	"category" "service_category" NOT NULL,
	"base_price" numeric(10, 2) NOT NULL,
	"gst_rate" numeric(5, 2) DEFAULT '18' NOT NULL,
	"pricing_type" "pricing_type" DEFAULT 'inclusive' NOT NULL,
	"pricing_model" "pricing_model" DEFAULT 'fixed' NOT NULL,
	"duration_minutes" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"status" "service_status" DEFAULT 'active' NOT NULL,
	"image_url" text,
	"gallery" json DEFAULT '[]'::json,
	"feature_icons" json DEFAULT '[]'::json,
	"benefits" json DEFAULT '[]'::json,
	"process" json DEFAULT '[]'::json,
	"faqs" json DEFAULT '[]'::json,
	"features" json DEFAULT '[]'::json,
	"seo_title" text,
	"seo_description" text,
	"seo_keywords" text,
	"og_image_url" text,
	"schema_data" json,
	"assignment_strategy" "assignment_strategy" DEFAULT 'manual' NOT NULL,
	"code" text,
	"service_type" text,
	"supported_vehicle_categories" json DEFAULT '[]'::json,
	"applicable_booking_modes" json DEFAULT '["one_time"]'::json,
	"default_config" json DEFAULT '{}'::json,
	"metadata" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"service_location_id" integer,
	"asset_id" integer,
	"vehicle_id" integer,
	"solar_site_id" integer,
	"service_id" integer,
	"type" "subscription_type" NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"next_service_date" date,
	"next_due_date" date,
	"frequency_days" integer,
	"recurrence_rule" text,
	"total_services" integer,
	"services_used" integer DEFAULT 0 NOT NULL,
	"services_remaining" integer,
	"grace_minutes" integer DEFAULT 60 NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"paid_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"due_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"company_id" integer,
	"franchisee_id" integer,
	"branch_id" integer,
	"pricing_rule_id" integer,
	"price_snapshot" jsonb,
	"zone_id" integer,
	"property_type" text,
	"notes" text,
	"cancelled_at" timestamp,
	"cancellation_remark" text,
	"renewal_reminder_sent_at" timestamp,
	"message_sent_at" timestamp,
	"paused_at" timestamp,
	"resumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "services_remaining_check" CHECK ("subscriptions"."total_services" IS NULL OR "subscriptions"."services_remaining" = "subscriptions"."total_services" - "subscriptions"."services_used")
);

CREATE TABLE IF NOT EXISTS "staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"franchisee_id" integer,
	"company_id" integer,
	"employee_code" text,
	"name" text NOT NULL,
	"profile_photo_url" text,
	"phone" text NOT NULL,
	"alternate_phone" text,
	"email" text,
	"date_of_birth" date,
	"gender" "staff_gender",
	"joining_date" date,
	"role" "staff_role" NOT NULL,
	"staff_category" "staff_category" DEFAULT 'cleaning_staff' NOT NULL,
	"branch_id" integer NOT NULL,
	"assigned_zone_id" integer,
	"city_id" integer,
	"city" text,
	"reporting_manager_id" integer,
	"employment_type" "staff_employment_type" DEFAULT 'salaried',
	"monthly_salary" numeric(10, 2),
	"per_wash_rate" numeric(10, 2),
	"per_daily_cleaning_rate" numeric(10, 2),
	"per_solar_panel_rate" numeric(10, 2),
	"per_solar_amc_visit_rate" numeric(10, 2),
	"owns_vehicle" boolean DEFAULT false NOT NULL,
	"vehicle_type" "staff_vehicle_type",
	"vehicle_registration_number" text,
	"petrol_model" "staff_petrol_model",
	"rate_per_km" numeric(10, 2),
	"availability" "staff_availability" DEFAULT 'available' NOT NULL,
	"weekly_off" text,
	"working_hours_start" text,
	"working_hours_end" text,
	"current_house_number" text,
	"current_street" text,
	"current_area" text,
	"current_landmark" text,
	"current_city" text,
	"current_state" text,
	"current_pincode" text,
	"permanent_house_number" text,
	"permanent_street" text,
	"permanent_area" text,
	"permanent_landmark" text,
	"permanent_city" text,
	"permanent_state" text,
	"permanent_pincode" text,
	"permanent_same_as_current" boolean DEFAULT false NOT NULL,
	"local_address" text,
	"permanent_address" text,
	"guardian_name" text,
	"guardian_phone" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"aadhaar" text,
	"pan" text,
	"bank_account_name" text,
	"bank_name" text,
	"bank_account_number" text,
	"bank_ifsc" text,
	"bank_branch" text,
	"upi_id" text,
	"bank_passbook_url" text,
	"agreement_url" text,
	"verification_status" "staff_verification_status" DEFAULT 'pending' NOT NULL,
	"verification_notes" text,
	"verified_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"profile_completion_percent" integer DEFAULT 0 NOT NULL,
	"identity_complete" boolean DEFAULT false NOT NULL,
	"documents_complete" boolean DEFAULT false NOT NULL,
	"bank_complete" boolean DEFAULT false NOT NULL,
	"address_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "staff_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" integer NOT NULL,
	"document_type" "staff_document_type" NOT NULL,
	"document_number" text,
	"title" text,
	"description" text,
	"file_url" text NOT NULL,
	"content_type" text,
	"file_size_bytes" integer,
	"expiry_date" date,
	"uploaded_by_user_id" integer,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"replaced_by_document_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "staff_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" integer NOT NULL,
	"author_user_id" integer,
	"author_name" text,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "staff_role_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"skill_level" "staff_skill_level" DEFAULT 'basic' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_role_assignments_staff_role" UNIQUE("staff_id","role_id")
);

CREATE TABLE IF NOT EXISTS "staff_role_master" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_role_master_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"contract_registry_id" integer,
	"service_location_id" integer,
	"asset_id" integer,
	"vehicle_id" integer,
	"solar_site_id" integer,
	"service_id" integer,
	"company_id" integer,
	"franchisee_id" integer,
	"branch_id" integer,
	"city_id" integer,
	"booking_type" "booking_type" DEFAULT 'one_time' NOT NULL,
	"scheduled_date" date NOT NULL,
	"scheduled_time" text,
	"scheduled_start_at" timestamp with time zone,
	"scheduled_end_at" timestamp with time zone,
	"duration_minutes" integer,
	"status" "booking_status" DEFAULT 'scheduled' NOT NULL,
	"service_type" "booking_service_type" NOT NULL,
	"address" text,
	"area" text,
	"location_lat" double precision,
	"location_lng" double precision,
	"place_id" text,
	"saved_location_id" integer,
	"address_snapshot_id" integer,
	"address_identity_id" integer,
	"address_id" integer,
	"notes" text,
	"cancellation_reason" text,
	"customer_confirmed_at" timestamp,
	"assigned_staff_id" integer,
	"started_at" timestamp,
	"completed_at" timestamp,
	"rescheduled_from_booking_id" integer,
	"rescheduled_to_booking_id" integer,
	"is_makeup_booking" boolean DEFAULT false NOT NULL,
	"makeup_eligibility_status" text,
	"technician_en_route_at" timestamp with time zone,
	"estimated_arrival_at" timestamp with time zone,
	"eta_minutes" integer,
	"last_location_update_at" timestamp with time zone,
	"last_known_latitude" double precision,
	"last_known_longitude" double precision,
	"pricing_rule_id" integer,
	"price_snapshot" jsonb,
	"zone_id" integer,
	"property_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "makeup_approval_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"city_id" integer,
	"branch_id" integer,
	"contract_registry_id" integer,
	"requested_date" date NOT NULL,
	"requested_time" text NOT NULL,
	"requested_notes" text,
	"reason" text NOT NULL,
	"status" "makeup_approval_status" DEFAULT 'pending' NOT NULL,
	"decided_by" integer,
	"decided_at" timestamp with time zone,
	"decision_reason" text,
	"created_booking_id" integer,
	"previous_makeups_count" integer DEFAULT 0 NOT NULL,
	"applicable_quota" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" integer NOT NULL,
	"date" date NOT NULL,
	"status" "attendance_status" NOT NULL,
	"check_in_time" text,
	"check_out_time" text,
	"notes" text,
	"selfie_photo_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "complaints" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_number" text,
	"customer_id" integer NOT NULL,
	"city_id" integer,
	"booking_id" integer,
	"subscription_id" integer,
	"visit_id" integer,
	"invoice_id" integer,
	"operational_exception_id" integer,
	"type" "complaint_type" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"photo_url" text,
	"internal_notes" text,
	"status" "complaint_status" DEFAULT 'open' NOT NULL,
	"priority" "complaint_priority" DEFAULT 'medium' NOT NULL,
	"sla_policy_id" integer,
	"response_due_at" timestamp,
	"resolution_due_at" timestamp,
	"first_responded_at" timestamp,
	"sla_paused_at" timestamp,
	"sla_total_paused_minutes" integer DEFAULT 0,
	"sla_status" text DEFAULT 'on_track',
	"escalation_level" integer DEFAULT 0,
	"escalated_at" timestamp,
	"resolution" text,
	"resolved_at" timestamp,
	"company_id" integer,
	"franchisee_id" integer,
	"branch_id" integer,
	"related_staff_id" integer,
	"assigned_supervisor_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sla_escalation_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"complaint_id" integer,
	"operational_exception_id" integer,
	"sla_policy_id" integer,
	"escalation_level" integer NOT NULL,
	"reason" text NOT NULL,
	"escalated_to_role" text NOT NULL,
	"escalated_to_user_id" integer,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sla_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city_id" integer,
	"service_type" text,
	"category" text DEFAULT 'all' NOT NULL,
	"priority" text DEFAULT 'all' NOT NULL,
	"response_target_minutes" integer DEFAULT 720 NOT NULL,
	"resolution_target_minutes" integer DEFAULT 1440 NOT NULL,
	"pause_on_customer_response" boolean DEFAULT true NOT NULL,
	"escalation_level_1_minutes" integer,
	"escalation_level_2_minutes" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"company_id" integer,
	"branch_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "support_ticket_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"complaint_id" integer NOT NULL,
	"sender_type" text NOT NULL,
	"sender_id" integer,
	"sender_name" text NOT NULL,
	"message" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"attachment_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"document_type" "invoice_document_type" DEFAULT 'tax_invoice' NOT NULL,
	"reference_invoice_id" integer,
	"reference_invoice_number" text,
	"reference_invoice_date" date,
	"customer_id" integer NOT NULL,
	"customer_snapshot" json,
	"legal_entity_id" integer,
	"legal_entity_snapshot" json,
	"subscription_id" integer,
	"booking_id" integer,
	"quotation_id" integer,
	"contract_registry_id" integer,
	"execution_id" integer,
	"service_location_id" integer,
	"asset_id" integer,
	"service_id" integer,
	"payment_terms" text,
	"billing_mode" "invoice_billing_mode",
	"commercial_status" "invoice_commercial_status" DEFAULT 'draft' NOT NULL,
	"commercially_closed_at" timestamp,
	"voided_at" timestamp,
	"void_reason" text,
	"entitlement_consumed" boolean DEFAULT false NOT NULL,
	"items" json DEFAULT '[]'::json NOT NULL,
	"subtotal" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(10, 2) DEFAULT '0' NOT NULL,
	"gst_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cgst_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"sgst_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"igst_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"round_off" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"paid_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"due_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"balance_due" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"gstin" text,
	"place_of_supply" text,
	"supply_state_code" text DEFAULT '09',
	"is_inter_state" boolean DEFAULT false NOT NULL,
	"hsn_summary" json,
	"notes" text,
	"terms" json,
	"credit_reason" text,
	"currency" text DEFAULT 'INR' NOT NULL,
	"company_id" integer,
	"franchisee_id" integer,
	"branch_id" integer,
	"due_date" date,
	"issued_at" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);

CREATE TABLE IF NOT EXISTS "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"invoice_id" integer,
	"booking_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"transaction_id" text,
	"status" "payment_status" DEFAULT 'completed' NOT NULL,
	"refund_status" text DEFAULT 'none' NOT NULL,
	"refunded_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"reconciliation_status" text DEFAULT 'unreconciled' NOT NULL,
	"reconciled_at" timestamp,
	"notes" text,
	"received_by_staff_id" integer,
	"received_at" timestamp,
	"reversal_of_id" integer,
	"company_id" integer,
	"branch_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payment_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"attempt_id" text NOT NULL,
	"gateway_provider" text DEFAULT 'cashfree' NOT NULL,
	"cf_order_id" text,
	"rzp_order_id" text,
	"gateway_order_id" text,
	"customer_id" integer NOT NULL,
	"invoice_id" integer,
	"booking_id" integer,
	"city_id" integer,
	"branch_id" integer,
	"subscription_id" integer,
	"legal_entity_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"cf_payment_session_id" text,
	"status" text DEFAULT 'initiated' NOT NULL,
	"cf_payment_id" text,
	"rzp_payment_id" text,
	"rzp_signature" text,
	"payment_method" text,
	"refund_status" text DEFAULT 'none' NOT NULL,
	"refunded_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"reconciliation_status" text DEFAULT 'unreconciled' NOT NULL,
	"reconciled_at" timestamp with time zone,
	"reconciliation_notes" text,
	"idempotency_key" text NOT NULL,
	"metadata" jsonb,
	"raw_webhook_payload" jsonb,
	"raw_verification_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempts_attempt_id_unique" UNIQUE("attempt_id"),
	CONSTRAINT "payment_attempts_cf_order_id_unique" UNIQUE("cf_order_id"),
	CONSTRAINT "payment_attempts_rzp_order_id_unique" UNIQUE("rzp_order_id"),
	CONSTRAINT "payment_attempts_idempotency_key_unique" UNIQUE("idempotency_key")
);

CREATE TABLE IF NOT EXISTS "quotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_number" text NOT NULL,
	"customer_id" integer NOT NULL,
	"lead_id" integer,
	"booking_id" integer,
	"contract_registry_id" integer,
	"service_location_id" integer,
	"asset_id" integer,
	"service_id" integer,
	"payment_terms" text,
	"items" json DEFAULT '[]'::json NOT NULL,
	"subtotal" numeric(10, 2) DEFAULT '0' NOT NULL,
	"gst_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cgst_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"sgst_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"igst_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"status" "quotation_status" DEFAULT 'draft' NOT NULL,
	"valid_until" date,
	"notes" text,
	"company_id" integer,
	"franchisee_id" integer,
	"branch_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_quotation_number_unique" UNIQUE("quotation_number")
);

CREATE TABLE IF NOT EXISTS "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" "expense_category" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"description" text,
	"vendor" text,
	"receipt_url" text,
	"paid_by" text,
	"expense_date" date NOT NULL,
	"company_id" integer,
	"branch_id" integer,
	"franchisee_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"customer_id" integer,
	"city_id" integer,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"channel" "notification_channel" DEFAULT 'in_app' NOT NULL,
	"delivery_status" "notification_delivery_status" DEFAULT 'pending' NOT NULL,
	"action_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"retry_count" integer DEFAULT 0,
	"error_message" text,
	"external_id" text,
	"dedupe_key" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_marketing" boolean DEFAULT false,
	"sensitive_masked" boolean DEFAULT false,
	"company_id" integer,
	"franchisee_id" integer,
	"branch_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "franchisees" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"branch_id" integer,
	"company_id" integer,
	"city_id" integer,
	"legal_entity_id" integer,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"secondary_phone" text,
	"current_address" text,
	"permanent_address" text,
	"aadhaar" text,
	"pan" text,
	"rent_agreement_url" text,
	"franchisee_agreement_url" text,
	"agreement_number" text,
	"commission_percentage" numeric(5, 2) DEFAULT '15.00',
	"tenure_start_date" date,
	"tenure_end_date" date,
	"final_amount_agreed" numeric(12, 2),
	"amount_deposited" numeric(12, 2) DEFAULT '0',
	"due_amount" numeric(12, 2) DEFAULT '0',
	"bank_account_name" text,
	"bank_account_number" text,
	"bank_ifsc" text,
	"bank_name" text,
	"status" "franchisee_status" DEFAULT 'pending' NOT NULL,
	"suspension_reason" text,
	"suspended_at" timestamp,
	"suspended_by" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"secondary_phone" text,
	"city" text,
	"source" "lead_source" NOT NULL,
	"service_interest" "lead_service_interest",
	"assigned_to_staff_id" integer,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"notes" text,
	"next_follow_up_at" timestamp,
	"value_estimate" numeric(10, 2),
	"lost_reason" "lead_lost_reason",
	"company_id" integer,
	"franchisee_id" integer,
	"branch_id" integer,
	"customer_id" integer,
	"booking_id" integer,
	"subscription_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "lead_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"type" "lead_activity_type" NOT NULL,
	"body" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "lead_ingestion_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"raw_payload" text NOT NULL,
	"processed_at" timestamp,
	"lead_id" integer,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "booking_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"type" "booking_event_type" NOT NULL,
	"from_status" text,
	"to_status" text,
	"body" text,
	"actor_id" integer,
	"actor_name" text,
	"location_lat" text,
	"location_lng" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "booking_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"snapshot_type" "booking_snapshot_type" NOT NULL,
	"snapshot_data" json DEFAULT '{}'::json NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"trace_id" text,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "booking_timeline" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"event_type" "booking_timeline_event_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"from_status" "booking_status",
	"to_status" "booking_status",
	"actor_id" integer,
	"actor_name" text,
	"metadata" json DEFAULT '{}'::json,
	"trace_id" text,
	"request_id" text,
	"booking_operation_id" text,
	"address_identity_id" integer,
	"address_snapshot_id" integer,
	"coverage_validation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "system_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_type" text NOT NULL,
	"status" "system_job_status" DEFAULT 'pending' NOT NULL,
	"payload" json,
	"run_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"last_run_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "wallet_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"company_id" integer,
	"type" "wallet_transaction_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"balance_after" numeric(10, 2) NOT NULL,
	"reference" text,
	"reference_id" integer,
	"payment_mode" "wallet_payment_mode",
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_audiences" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer,
	"name" text NOT NULL,
	"description" text,
	"filter_definition" json NOT NULL,
	"estimated_count" integer,
	"company_id" integer,
	"branch_id" integer,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" integer,
	"user_id" integer,
	"payload" json,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_automations" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer,
	"name" text NOT NULL,
	"trigger" "comm_automation_trigger" NOT NULL,
	"channel" "comm_channel" NOT NULL,
	"template_id" integer NOT NULL,
	"audience_id" integer,
	"delay_minutes" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"config" json DEFAULT '{}'::json,
	"company_id" integer,
	"branch_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_campaign_attribution" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"booking_id" integer,
	"invoice_id" integer,
	"revenue_amount" numeric(10, 2) NOT NULL,
	"attributed_at" timestamp DEFAULT now() NOT NULL,
	"company_id" integer
);

CREATE TABLE IF NOT EXISTS "comm_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer,
	"name" text NOT NULL,
	"channel" "comm_channel" NOT NULL,
	"audience_id" integer,
	"template_id" integer,
	"email_template_id" integer,
	"whatsapp_template_id" integer,
	"status" "comm_campaign_status" DEFAULT 'draft' NOT NULL,
	"recurrence" "comm_campaign_recurrence" DEFAULT 'none' NOT NULL,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"cost_amount" numeric(10, 2) DEFAULT '0',
	"stats" json DEFAULT '{}'::json,
	"company_id" integer,
	"branch_id" integer,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_customer_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"brand_id" integer,
	"sms_consent" boolean DEFAULT false NOT NULL,
	"whatsapp_consent" boolean DEFAULT false NOT NULL,
	"email_consent" boolean DEFAULT false NOT NULL,
	"push_consent" boolean DEFAULT false NOT NULL,
	"consent_source" "comm_consent_source" DEFAULT 'manual' NOT NULL,
	"consent_date" timestamp DEFAULT now() NOT NULL,
	"consent_ip" text,
	"birth_date" date,
	"anniversary_date" date,
	"notes" text,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_dlt_entities" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer,
	"name" text NOT NULL,
	"entity_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_dlt_headers" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_id" integer NOT NULL,
	"header_id" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer,
	"campaign_id" integer,
	"automation_id" integer,
	"customer_id" integer,
	"lead_id" integer,
	"channel" "comm_channel" NOT NULL,
	"template_id" integer,
	"rendered_body" text NOT NULL,
	"rendered_subject" text,
	"status" "comm_event_status" DEFAULT 'pending' NOT NULL,
	"external_id" text,
	"error_message" text,
	"metadata" json,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"read_at" timestamp,
	"clicked_at" timestamp,
	"converted_at" timestamp,
	"revenue" numeric(10, 2),
	"retry_count" integer DEFAULT 0 NOT NULL,
	"company_id" integer,
	"branch_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer,
	"name" text NOT NULL,
	"provider_type" "comm_provider_type" NOT NULL,
	"channel" "comm_channel" NOT NULL,
	"config" json DEFAULT '{}'::json,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_smart_segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"segment_key" text NOT NULL,
	"config_json" json NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer,
	"name" text NOT NULL,
	"channel" "comm_channel" DEFAULT 'sms' NOT NULL,
	"category" "dlt_template_category" DEFAULT 'transactional' NOT NULL,
	"dlt_template_id" text,
	"header_id" integer,
	"subject" text,
	"body" text NOT NULL,
	"variables" json DEFAULT '[]'::json,
	"is_active" boolean DEFAULT true NOT NULL,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_ai_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer,
	"recommendation_type" "comm_ai_recommendation_type" NOT NULL,
	"target_entity" text,
	"target_id" integer,
	"suggestion" json NOT NULL,
	"confidence" numeric(5, 4),
	"status" text DEFAULT 'pending' NOT NULL,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_brands" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"status" "comm_brand_status" DEFAULT 'active' NOT NULL,
	"logo" text,
	"primary_color" text,
	"email_sender" text,
	"email_reply_to" text,
	"default_sms_header" text,
	"default_whatsapp_number" text,
	"default_support_number" text,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_consent_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"brand_id" integer,
	"sms_consent" boolean,
	"whatsapp_consent" boolean,
	"email_consent" boolean,
	"push_consent" boolean,
	"consent_source" "comm_consent_source",
	"changed_by" integer,
	"consent_ip" text,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_dead_letter" (
	"id" serial PRIMARY KEY NOT NULL,
	"queue_job_id" integer,
	"event_id" integer,
	"channel" "comm_channel" NOT NULL,
	"payload" json,
	"error" text NOT NULL,
	"brand_id" integer,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_dlt_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer NOT NULL,
	"entity_id" integer NOT NULL,
	"header_id" integer NOT NULL,
	"template_id" text NOT NULL,
	"name" text NOT NULL,
	"template_type" "dlt_template_category" NOT NULL,
	"approved_content" text NOT NULL,
	"variables" json DEFAULT '[]'::json,
	"status" "comm_dlt_template_status" DEFAULT 'approved' NOT NULL,
	"approval_date" timestamp,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"html_content" text NOT NULL,
	"email_type" "comm_email_type" DEFAULT 'transactional' NOT NULL,
	"variables" json DEFAULT '[]'::json,
	"attachments" json DEFAULT '[]'::json,
	"is_active" boolean DEFAULT true NOT NULL,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_queue_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"queue_name" "comm_queue_name" NOT NULL,
	"bull_job_id" text,
	"event_id" integer,
	"campaign_id" integer,
	"brand_id" integer,
	"payload" json NOT NULL,
	"status" "comm_delivery_status" DEFAULT 'queued' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 4 NOT NULL,
	"next_retry_at" timestamp,
	"last_error" text,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_timeline" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer,
	"customer_id" integer,
	"lead_id" integer,
	"channel" "comm_channel" NOT NULL,
	"template_id" integer,
	"campaign_id" integer,
	"automation_id" integer,
	"event_id" integer,
	"message" text NOT NULL,
	"subject" text,
	"status" text NOT NULL,
	"provider" text,
	"delivery_status" "comm_delivery_status" DEFAULT 'queued' NOT NULL,
	"read_status" boolean DEFAULT false NOT NULL,
	"clicked" boolean DEFAULT false NOT NULL,
	"responded" boolean DEFAULT false NOT NULL,
	"metadata" json,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_whatsapp_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer NOT NULL,
	"meta_template_name" text NOT NULL,
	"category" "comm_whatsapp_category" NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"body_preview" text NOT NULL,
	"variables" json DEFAULT '[]'::json,
	"approval_status" "comm_whatsapp_approval_status" DEFAULT 'approved' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_workflow_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_id" integer NOT NULL,
	"customer_id" integer,
	"lead_id" integer,
	"current_step_id" integer,
	"status" "comm_automation_run_status" DEFAULT 'pending' NOT NULL,
	"context" json DEFAULT '{}'::json,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error" text,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_workflow_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_id" integer NOT NULL,
	"step_order" integer NOT NULL,
	"step_type" "comm_automation_step_type" NOT NULL,
	"config" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_workflows" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer NOT NULL,
	"name" text NOT NULL,
	"trigger" "comm_workflow_trigger" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"config" json DEFAULT '{}'::json,
	"company_id" integer,
	"branch_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_agent_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"period_date" text NOT NULL,
	"messages_handled" integer DEFAULT 0 NOT NULL,
	"conversations_closed" integer DEFAULT 0 NOT NULL,
	"avg_response_time_sec" integer DEFAULT 0 NOT NULL,
	"csat_avg" numeric(3, 2),
	"revenue_generated" numeric(10, 2) DEFAULT '0',
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_ai_assistance" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"summary" text,
	"sentiment" text,
	"intent" text,
	"priority" text,
	"reply_suggestions" json DEFAULT '[]'::json,
	"lead_qualification_hints" json DEFAULT '{}'::json,
	"status" text DEFAULT 'pending' NOT NULL,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_channel_costs" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer,
	"brand_id" integer,
	"channel" "comm_channel" NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"cost_amount" numeric(10, 4) DEFAULT '0' NOT NULL,
	"revenue_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"company_id" integer,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_conversation_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"channel" "comm_channel" NOT NULL,
	"direction" "comm_message_direction" NOT NULL,
	"message" text NOT NULL,
	"attachments" json DEFAULT '[]'::json,
	"provider_message_id" text,
	"status" "comm_message_delivery" DEFAULT 'pending' NOT NULL,
	"sender" text,
	"receiver" text,
	"sender_user_id" integer,
	"reply_to_message_id" integer,
	"metadata" json DEFAULT '{}'::json,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_conversation_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"author_user_id" integer NOT NULL,
	"body" text NOT NULL,
	"mentions" json DEFAULT '[]'::json,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_conversation_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"tag" text NOT NULL,
	"source" "comm_tag_source" DEFAULT 'manual' NOT NULL,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer,
	"customer_id" integer,
	"lead_id" integer,
	"primary_channel" "comm_channel" DEFAULT 'whatsapp' NOT NULL,
	"status" "comm_conversation_status" DEFAULT 'open' NOT NULL,
	"subject" text,
	"assigned_to_user_id" integer,
	"assigned_team_id" integer,
	"complaint_id" integer,
	"email_thread_id" text,
	"is_unknown_contact" boolean DEFAULT false NOT NULL,
	"unknown_phone" text,
	"unknown_email" text,
	"sla_policy_id" integer,
	"sla_status" "comm_sla_status" DEFAULT 'within_sla' NOT NULL,
	"first_response_due_at" timestamp,
	"resolution_due_at" timestamp,
	"first_response_at" timestamp,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	"last_message_at" timestamp,
	"last_message_preview" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"metadata" json DEFAULT '{}'::json,
	"company_id" integer,
	"branch_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_csat_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"customer_id" integer,
	"agent_user_id" integer,
	"rating" integer NOT NULL,
	"feedback" text,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_journey_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"lead_id" integer,
	"event_type" "comm_journey_event_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"entity_type" text,
	"entity_id" integer,
	"metadata" json DEFAULT '{}'::json,
	"brand_id" integer,
	"company_id" integer,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_knowledge_base" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer,
	"title" text NOT NULL,
	"category" "comm_kb_category" DEFAULT 'faq' NOT NULL,
	"content" text NOT NULL,
	"tags" json DEFAULT '[]'::json,
	"is_active" boolean DEFAULT true NOT NULL,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_link_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"tracking_id" text NOT NULL,
	"campaign_id" integer,
	"customer_id" integer,
	"brand_id" integer,
	"original_url" text NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"visited_at" timestamp,
	"converted_at" timestamp,
	"conversion_value" numeric(10, 2),
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_sla_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"first_response_minutes" integer DEFAULT 30 NOT NULL,
	"resolution_minutes" integer DEFAULT 1440 NOT NULL,
	"escalation_minutes" integer DEFAULT 60 NOT NULL,
	"warning_threshold_pct" integer DEFAULT 80 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"auto_assign_rules" json DEFAULT '{}'::json,
	"is_active" boolean DEFAULT true NOT NULL,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_ticket_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"trigger" "comm_ticket_rule_trigger" NOT NULL,
	"tag_match" text,
	"intent_match" text,
	"complaint_type" text DEFAULT 'other' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comm_unknown_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer,
	"phone" text,
	"email" text,
	"channel" "comm_channel" NOT NULL,
	"last_message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"linked_customer_id" integer,
	"linked_lead_id" integer,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "platform_branding" (
	"id" serial PRIMARY KEY NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"company_name" text DEFAULT 'CWP Detailers + Kleansolar' NOT NULL,
	"brand_name" text DEFAULT 'CWP Detailers' NOT NULL,
	"tagline" text DEFAULT 'Premium Car Care & Solar Cleaning',
	"short_description" text,
	"full_logo_url" text,
	"navbar_logo_url" text,
	"mobile_logo_url" text,
	"light_logo_url" text,
	"dark_logo_url" text,
	"login_logo_url" text,
	"logo_white_url" text,
	"logo_transparent_url" text,
	"logo_square_url" text,
	"logo_icon_url" text,
	"favicon_url" text,
	"favicon_ico_url" text,
	"pwa_icon_url" text,
	"apple_touch_icon_url" text,
	"email_logo_url" text,
	"invoice_logo_url" text,
	"pdf_logo_url" text,
	"splash_logo_url" text,
	"loader_animation_url" text,
	"loader_background_color" text,
	"loader_text" text DEFAULT 'Loading…',
	"og_image_url" text,
	"twitter_image_url" text,
	"seo_keywords" text,
	"seo_author" text,
	"primary_color" text DEFAULT '#00cccc' NOT NULL,
	"secondary_color" text DEFAULT '#212529' NOT NULL,
	"accent_color" text DEFAULT '#e0ffff' NOT NULL,
	"background_color" text DEFAULT '#f5f6f8' NOT NULL,
	"text_color" text DEFAULT '#212529',
	"website" text,
	"support_email" text,
	"support_phone" text,
	"gst_number" text,
	"address" text,
	"meta_title_template" text DEFAULT '{brand} | {tagline}',
	"meta_description_template" text,
	"og_title" text,
	"og_description" text,
	"twitter_card_type" text DEFAULT 'summary_large_image',
	"twitter_title" text,
	"twitter_description" text,
	"social_links" jsonb,
	"schema_org" jsonb,
	"generated_assets" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "business_info" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_name" text DEFAULT 'CWP Detailers And Motors' NOT NULL,
	"owner_name" text DEFAULT 'Tushar Saraswat' NOT NULL,
	"business_type" text DEFAULT 'Proprietorship' NOT NULL,
	"gst_number" text,
	"support_email" text DEFAULT 'cwpdetailers@gmail.com' NOT NULL,
	"support_phone" text DEFAULT '+91-7054007733' NOT NULL,
	"whatsapp_number" text,
	"alternate_phone" text,
	"address_line1" text DEFAULT 'Seer Goverdhanpur, Behind BHU' NOT NULL,
	"address_line2" text,
	"city" text DEFAULT 'Varanasi' NOT NULL,
	"state" text DEFAULT 'Uttar Pradesh' NOT NULL,
	"pin_code" text DEFAULT '221005' NOT NULL,
	"country" text DEFAULT 'India' NOT NULL,
	"services" jsonb DEFAULT '["Car Wash","Solar Panel Cleaning & Maintenance","Vehicle Detailing","Ceramic Coating","Graphene Coating","PPF","Bike Detailing","Dent & Paint Services"]'::jsonb,
	"facebook" text,
	"instagram" text,
	"youtube" text,
	"linkedin" text,
	"twitter" text,
	"website" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "legal_page_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" integer NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"seo_keywords" text,
	"canonical_url" text,
	"og_title" text,
	"og_description" text,
	"saved_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "legal_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"status" "legal_page_status" DEFAULT 'draft' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"seo_keywords" text,
	"canonical_url" text,
	"og_title" text,
	"og_description" text,
	"og_image" text,
	"last_updated_by" text,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "legal_pages_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "oauth_compliance_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"data_collected" text DEFAULT 'Name, Email address, Profile photo' NOT NULL,
	"data_usage_description" text DEFAULT 'We use your name, email and profile image solely to create and manage your account on our platform. We do not share or sell your data to any third party.' NOT NULL,
	"data_retention_description" text DEFAULT 'We retain your personal data for as long as your account is active. Upon deletion request, data is permanently removed within 30 days.' NOT NULL,
	"data_deletion_process" text DEFAULT 'Users can request data deletion by emailing cwpdetailers@gmail.com. We will process the request within 30 days.' NOT NULL,
	"privacy_policy_url" text DEFAULT '/privacy-policy' NOT NULL,
	"terms_url" text DEFAULT '/terms-and-conditions' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "refund_policy_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"refund_eligible_cases" jsonb DEFAULT '["Service failure on company side","Service not delivered as promised","Duplicate payment","Technical error in payment processing"]'::jsonb,
	"non_refundable_cases" jsonb DEFAULT '["Customer-initiated cancellation","Service already rendered","Partial service completion at customer request"]'::jsonb,
	"refund_processing_days" text DEFAULT '7-10 business days' NOT NULL,
	"cancellation_rules" text DEFAULT 'Cancellations initiated by the customer are non-refundable. Company-side failures are fully eligible for refund.' NOT NULL,
	"advance_payment_rules" text,
	"partial_payment_rules" text,
	"full_payment_rules" text,
	"settlement_info" text,
	"accepted_payment_methods" jsonb DEFAULT '["UPI","Credit Card","Debit Card","Net Banking","Wallets"]'::jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "seo_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_title" text DEFAULT 'CWP Detailers And Motors — Professional Car Detailing in Varanasi' NOT NULL,
	"site_description" text DEFAULT 'CWP Detailers And Motors offers professional car wash, vehicle detailing, ceramic coating, PPF, graphene coating, solar panel cleaning, and bike detailing services in Varanasi, UP.' NOT NULL,
	"meta_keywords" text,
	"canonical_domain" text DEFAULT 'https://cwpdetailers.in' NOT NULL,
	"og_title" text,
	"og_description" text,
	"og_image" text,
	"twitter_card_type" text DEFAULT 'summary_large_image',
	"twitter_title" text,
	"twitter_description" text,
	"robots_index" boolean DEFAULT true NOT NULL,
	"robots_follow" boolean DEFAULT true NOT NULL,
	"robots_additional_rules" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "fuel_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fuel_types_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "seat_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"seat_count" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seat_categories_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "vehicle_brands" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_brands_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "vehicle_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_categories_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "vehicle_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"vehicle_category_id" integer NOT NULL,
	"seat_category_id" integer NOT NULL,
	"fuel_type_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"state_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"code" text,
	"status" "city_status" DEFAULT 'draft' NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"locale" text DEFAULT 'en-IN' NOT NULL,
	"contact_phone" text,
	"contact_email" text,
	"operational_settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"launched_at" timestamp,
	"suspended_at" timestamp,
	"suspension_reason" text,
	"archived_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pincodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_area_id" integer NOT NULL,
	"pincode" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "service_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"city_id" integer NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "states" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "states_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "saved_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"label" text NOT NULL,
	"address" text NOT NULL,
	"house_number" text,
	"building_name" text,
	"area" text,
	"landmark" text,
	"city_id" integer,
	"city_name" text,
	"pincode" text,
	"latitude" double precision,
	"longitude" double precision,
	"place_id" text,
	"formatted_address" text,
	"google_components" jsonb,
	"property_type" text DEFAULT 'OTHER',
	"locality_id" integer,
	"society_id" integer,
	"tower_id" integer,
	"zone_id" integer,
	"branch_id" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "address_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"identity_id" integer NOT NULL,
	"address_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_reason" text,
	"superseded_at" timestamp DEFAULT now() NOT NULL,
	"superseded_by_address_id" integer
);

CREATE TABLE IF NOT EXISTS "address_identities" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"canonical_place_id" text,
	"canonical_latitude" double precision,
	"canonical_longitude" double precision,
	"fingerprint" text NOT NULL,
	"status" "address_identity_status" DEFAULT 'ACTIVE' NOT NULL,
	"merged_into_identity_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "address_legacy_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"address_id" integer,
	"identity_id" integer,
	"legacy_table" text NOT NULL,
	"legacy_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "address_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"identity_id" integer NOT NULL,
	"address_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"location_context" jsonb,
	"coverage_validation_id" text,
	"snapshot_reason" "address_snapshot_reason" DEFAULT 'API' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"identity_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"nickname" text,
	"address_type" "address_type" DEFAULT 'HOME' NOT NULL,
	"house_number" text,
	"building_name" text,
	"floor" text,
	"apartment" text,
	"street" text,
	"landmark" text,
	"area" text,
	"locality" text,
	"sub_locality" text,
	"city_id" integer,
	"district" text,
	"state_id" integer,
	"country" text DEFAULT 'India' NOT NULL,
	"postal_code" text,
	"latitude" double precision,
	"longitude" double precision,
	"place_id" text,
	"formatted_address" text,
	"plus_code" text,
	"address_components" jsonb,
	"instructions" text,
	"normalized_address" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"verification_status" "address_verification_status" DEFAULT 'UNKNOWN' NOT NULL,
	"source" "address_source" DEFAULT 'MANUAL' NOT NULL,
	"confidence_score" integer,
	"location_context_snapshot" jsonb,
	"property_type" text DEFAULT 'OTHER',
	"locality_id" integer,
	"society_id" integer,
	"tower_id" integer,
	"zone_id" integer,
	"branch_id" integer,
	"serviceability_status" text,
	"resolution_status" text,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"archived_at" timestamp
);

CREATE TABLE IF NOT EXISTS "customer_location_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"service_location_id" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"effective_from" date,
	"effective_until" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "service_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"address" text,
	"city" text,
	"city_id" integer,
	"society_id" integer,
	"tower_id" integer,
	"flat_number" text,
	"parking_level" text,
	"parking_bay" text,
	"parking_notes" text,
	"latitude" double precision,
	"longitude" double precision,
	"place_id" text,
	"location_type" "service_location_type" DEFAULT 'other' NOT NULL,
	"status" "service_location_status" DEFAULT 'active' NOT NULL,
	"is_auto_created" boolean DEFAULT false NOT NULL,
	"company_id" integer,
	"franchisee_id" integer,
	"branch_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_type" "asset_type" NOT NULL,
	"vehicle_id" integer,
	"solar_site_id" integer,
	"label" text NOT NULL,
	"notes" text,
	"status" "asset_status" DEFAULT 'active' NOT NULL,
	"company_id" integer,
	"franchisee_id" integer,
	"branch_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "customer_asset_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"link_type" "customer_asset_link_type" DEFAULT 'commercial' NOT NULL,
	"effective_from" date,
	"effective_until" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "location_asset_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"service_location_id" integer NOT NULL,
	"effective_from" date,
	"effective_until" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "service_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon_url" text,
	"legacy_category" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"show_on_website" boolean DEFAULT true NOT NULL,
	"show_in_booking" boolean DEFAULT true NOT NULL,
	"show_in_seo" boolean DEFAULT true NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"seo_keywords" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_categories_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "service_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_months" integer,
	"price" numeric(10, 2) NOT NULL,
	"gst_rate" numeric(5, 2) DEFAULT '18' NOT NULL,
	"pricing_type" text DEFAULT 'inclusive' NOT NULL,
	"city_id" integer,
	"features" json DEFAULT '[]'::json,
	"tag" text,
	"is_highlighted" boolean DEFAULT false NOT NULL,
	"show_on_homepage" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "service_pricing" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"city_id" integer,
	"branch_id" integer,
	"vehicle_category_id" integer,
	"seat_category_id" integer,
	"price" numeric(10, 2) NOT NULL,
	"gst_rate" numeric(5, 2),
	"pricing_type" text,
	"duration_minutes" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_until" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "migration_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text,
	"city_slug" text,
	"import_mode" text DEFAULT 'upsert' NOT NULL,
	"status" "migration_batch_status" DEFAULT 'preview' NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "migration_entity_map" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"entity_type" "migration_entity_type" NOT NULL,
	"legacy_id" text NOT NULL,
	"platform_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "migration_row_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"sheet_name" text NOT NULL,
	"row_number" integer NOT NULL,
	"status" "migration_row_status" NOT NULL,
	"message" text,
	"legacy_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "dcms_activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer,
	"performed_by" integer,
	"metadata_json" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "dcms_missed_visit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"visit_date" date NOT NULL,
	"reason" text DEFAULT 'no_cleaning_completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "dcms_operational_exceptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"visit_id" integer,
	"society_id" integer,
	"city_id" integer,
	"staff_id" integer,
	"exception_type" "dcms_exception_type" NOT NULL,
	"status" "dcms_exception_status" DEFAULT 'open' NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"evidence_photo_url" text,
	"reported_at" timestamp DEFAULT now() NOT NULL,
	"reported_by" integer,
	"resolution_action" text,
	"resolution_notes" text,
	"resolved_at" timestamp,
	"resolved_by" integer,
	"complaint_id" integer,
	"company_id" integer,
	"branch_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "dcms_pause_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"action" "dcms_pause_action" NOT NULL,
	"pause_start_date" date,
	"pause_end_date" date,
	"pause_reason" text,
	"approval_status" "dcms_pause_approval_status",
	"performed_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "dcms_plan_addons" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"addon_id" integer NOT NULL,
	"included_cleanings" integer DEFAULT 0 NOT NULL,
	"included_washes" integer DEFAULT 0 NOT NULL,
	"extra_price" numeric(10, 2),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "dcms_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"included_cleanings" integer NOT NULL,
	"included_washes" integer DEFAULT 0 NOT NULL,
	"weekly_offs" integer DEFAULT 1 NOT NULL,
	"vehicle_category_id" integer,
	"seat_category_id" integer,
	"city_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"show_on_homepage" boolean DEFAULT false NOT NULL,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "dcms_staff_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"staff_id" integer NOT NULL,
	"assigned_by" integer,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"route_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "dcms_subscription_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"radius_meters" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "dcms_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"city_id" integer,
	"service_location_id" integer,
	"society_id" integer,
	"tower_id" integer,
	"parking_bay" text,
	"asset_id" integer,
	"vehicle_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"subscription_type" "dcms_subscription_type" DEFAULT 'daily_cleaning' NOT NULL,
	"start_date" date NOT NULL,
	"allocated_cleanings" integer NOT NULL,
	"allocated_washes" integer DEFAULT 0 NOT NULL,
	"used_cleanings" integer DEFAULT 0 NOT NULL,
	"used_washes" integer DEFAULT 0 NOT NULL,
	"remaining_cleanings" integer NOT NULL,
	"remaining_washes" integer DEFAULT 0 NOT NULL,
	"missed_cleanings" integer DEFAULT 0 NOT NULL,
	"status" "dcms_subscription_status" DEFAULT 'active' NOT NULL,
	"pause_start_date" date,
	"pause_end_date" date,
	"pause_reason" text,
	"cancellation_reason" text,
	"cancellation_feedback" text,
	"churn_risk_level" text DEFAULT 'low',
	"cancellation_requested_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"company_id" integer,
	"franchisee_id" integer,
	"branch_id" integer,
	"pricing_rule_id" integer,
	"price_snapshot" jsonb,
	"zone_id" integer,
	"property_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "dcms_visit_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"visit_id" integer NOT NULL,
	"subscription_id" integer,
	"customer_id" integer NOT NULL,
	"staff_id" integer,
	"city_id" integer,
	"branch_id" integer,
	"rating" text NOT NULL,
	"rating_score" integer,
	"comment" text,
	"tags" json DEFAULT '[]'::json,
	"issue_reported" boolean DEFAULT false,
	"complaint_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "dcms_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"vehicle_id" integer NOT NULL,
	"staff_id" integer NOT NULL,
	"visit_type" "dcms_visit_type" DEFAULT 'cleaning' NOT NULL,
	"photo_url" text,
	"visit_time" timestamp DEFAULT now() NOT NULL,
	"visit_date" date,
	"status" "dcms_visit_status" DEFAULT 'completed' NOT NULL,
	"exif_json" json,
	"latitude" double precision,
	"longitude" double precision,
	"accuracy" double precision,
	"rejection_reason" text,
	"ocr_text" text,
	"ocr_confidence" double precision,
	"confirmed_registration" text,
	"media_purged_at" timestamp,
	"retention_hold" boolean DEFAULT false,
	"cloudinary_deletion_status" text,
	"media_purged_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notification_event_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"action" text DEFAULT 'created' NOT NULL,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notification_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" "dcms_notification_event_type" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"payload" json DEFAULT '{}'::json NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "extra_service_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_type" "extra_service_request_type" DEFAULT 'extra_car_wash' NOT NULL,
	"status" "extra_service_request_status" DEFAULT 'pending_customer_approval' NOT NULL,
	"customer_id" integer NOT NULL,
	"staff_id" integer NOT NULL,
	"vehicle_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"addon_ids" json DEFAULT '[]'::json NOT NULL,
	"commercial_source" "extra_service_commercial_source" NOT NULL,
	"dcms_subscription_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"request_fingerprint" text NOT NULL,
	"consent_snapshot" json NOT NULL,
	"otp_code_hash" text,
	"otp_code" text,
	"otp_expires_at" timestamp,
	"otp_attempt_count" integer DEFAULT 0 NOT NULL,
	"otp_verified_at" timestamp,
	"otp_verified_by_staff_id" integer,
	"customer_approved_at" timestamp,
	"customer_rejected_at" timestamp,
	"entitlement_consumed_at" timestamp,
	"booking_id" integer,
	"execution_id" integer,
	"company_id" integer,
	"franchisee_id" integer,
	"branch_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "push_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"notification_event_id" integer,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"payload" json DEFAULT '{}'::json NOT NULL,
	"channel" text DEFAULT 'web_push' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"event_type" text,
	"reason" text,
	"recipient_role" text,
	"recipient_name" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"role" text NOT NULL,
	"endpoint" text NOT NULL,
	"keys" json NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);

CREATE TABLE IF NOT EXISTS "staff_location_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" integer NOT NULL,
	"company_id" integer,
	"branch_id" integer,
	"booking_id" integer,
	"subscription_id" integer,
	"action" "staff_location_action" NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"accuracy_meters" double precision,
	"geo_fence_verified" boolean,
	"geo_fence_radius_meters" integer,
	"distance_meters" double precision,
	"target_latitude" double precision,
	"target_longitude" double precision,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS "residential_societies" (
	"id" serial PRIMARY KEY NOT NULL,
	"city_id" integer NOT NULL,
	"service_area_id" integer,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"address" text NOT NULL,
	"pincode" text,
	"latitude" double precision,
	"longitude" double precision,
	"gate_security_notes" text,
	"total_towers" integer DEFAULT 0,
	"total_flats" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"company_id" integer,
	"branch_id" integer,
	"franchisee_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "society_towers" (
	"id" serial PRIMARY KEY NOT NULL,
	"society_id" integer NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"total_floors" integer,
	"total_flats" integer,
	"parking_levels" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "invoice_number_sequences" (
	"id" serial PRIMARY KEY NOT NULL,
	"legal_entity_id" integer NOT NULL,
	"document_type" text DEFAULT 'tax_invoice' NOT NULL,
	"financial_year" text NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"prefix" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "legal_entities" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"trade_name" text,
	"entity_type" text DEFAULT 'company' NOT NULL,
	"gstin" text,
	"pan_number" text,
	"state_code" text DEFAULT '09' NOT NULL,
	"state_name" text DEFAULT 'Uttar Pradesh' NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text NOT NULL,
	"pincode" text NOT NULL,
	"phone" text,
	"email" text,
	"website" text,
	"bank_account_name" text,
	"bank_name" text,
	"bank_account_number" text,
	"bank_ifsc" text,
	"bank_branch" text,
	"upi_id" text,
	"default_sac" text DEFAULT '998533',
	"invoice_prefix" text DEFAULT 'CWP' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"terms_and_conditions" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "legal_entities_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"subtitle" text,
	"banner_type" varchar(50) DEFAULT 'first_party' NOT NULL,
	"placement" varchar(50) DEFAULT 'home_hero' NOT NULL,
	"city_id" integer,
	"branch_id" integer,
	"service_id" integer,
	"campaign_id" integer,
	"badge_text" varchar(100),
	"image_url" text,
	"desktop_image_url" text,
	"mobile_image_url" text,
	"alt_text" text,
	"cta_text" varchar(100),
	"cta_link" varchar(500),
	"highlights" json,
	"advertiser_name" varchar(255),
	"advertiser_contact" varchar(255),
	"admin_notes" text,
	"target_audience" varchar(50) DEFAULT 'all',
	"status" varchar(20) DEFAULT 'published',
	"start_date" timestamp,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"impression_count" integer DEFAULT 0 NOT NULL,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "city_landing_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"city_id" integer NOT NULL,
	"branch_id" integer,
	"slug" varchar(100) NOT NULL,
	"page_title" text NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"seo_keywords" text,
	"canonical_url" text,
	"og_title" text,
	"og_description" text,
	"og_image" text,
	"hero_headline" text,
	"hero_subheadline" text,
	"custom_faqs" jsonb DEFAULT '[]'::jsonb,
	"custom_testimonials" jsonb DEFAULT '[]'::jsonb,
	"localized_content" jsonb DEFAULT '{}'::jsonb,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "homepage_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_key" varchar(60) NOT NULL,
	"title" varchar(255),
	"subtitle" text,
	"city_id" integer,
	"branch_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb,
	"scheduled_publish_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "marketing_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"city_id" integer,
	"branch_id" integer,
	"offer_type" varchar(50) DEFAULT 'percentage_discount' NOT NULL,
	"discount_value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"min_order_amount" numeric(10, 2) DEFAULT '0',
	"max_discount_amount" numeric(10, 2),
	"applicable_service_ids" jsonb DEFAULT '[]'::jsonb,
	"applicable_package_ids" jsonb DEFAULT '[]'::jsonb,
	"applicable_vehicle_categories" jsonb DEFAULT '[]'::jsonb,
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"per_customer_limit" integer DEFAULT 1,
	"eligibility_rule" varchar(50) DEFAULT 'all',
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"terms_and_conditions" text,
	"banner_id" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_campaigns_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "marketing_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"banner_id" integer,
	"campaign_id" integer,
	"city_id" integer,
	"branch_id" integer,
	"customer_id" integer,
	"session_id" text,
	"order_id" text,
	"conversion_value" numeric(10, 2),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "marketing_media_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"alt_text" text,
	"file_url" text NOT NULL,
	"thumbnail_url" text,
	"file_type" varchar(50),
	"file_size_bytes" integer,
	"width" integer,
	"height" integer,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"city_id" integer,
	"branch_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"city_id" integer,
	"branch_id" integer,
	"performed_by" integer NOT NULL,
	"reason" text,
	"details" jsonb,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "staff_payout_ledgers" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" integer NOT NULL,
	"city_id" integer,
	"branch_id" integer,
	"period_month" text NOT NULL,
	"employment_type" "staff_employment_type" DEFAULT 'salaried' NOT NULL,
	"base_salary" numeric(10, 2) DEFAULT '0' NOT NULL,
	"per_wash_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"per_daily_cleaning_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"per_solar_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"rate_per_km" numeric(10, 2) DEFAULT '0' NOT NULL,
	"completed_washes" integer DEFAULT 0 NOT NULL,
	"completed_daily_cleans" integer DEFAULT 0 NOT NULL,
	"completed_solar_visits" integer DEFAULT 0 NOT NULL,
	"distance_km" numeric(10, 2) DEFAULT '0' NOT NULL,
	"wash_earnings" numeric(10, 2) DEFAULT '0' NOT NULL,
	"daily_cleaning_earnings" numeric(10, 2) DEFAULT '0' NOT NULL,
	"solar_earnings" numeric(10, 2) DEFAULT '0' NOT NULL,
	"distance_allowance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"gross_payout" numeric(10, 2) DEFAULT '0' NOT NULL,
	"deductions" numeric(10, 2) DEFAULT '0' NOT NULL,
	"incentives" numeric(10, 2) DEFAULT '0' NOT NULL,
	"net_payout_due" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" "staff_payout_status" DEFAULT 'draft' NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp with time zone,
	"disbursed_by" integer,
	"disbursed_at" timestamp with time zone,
	"payment_method" text,
	"transaction_reference" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "customer_referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrer_customer_id" integer NOT NULL,
	"referee_customer_id" integer NOT NULL,
	"referral_code" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attributed_booking_id" integer,
	"booking_completed_at" timestamp,
	"referrer_reward_points" integer DEFAULT 0 NOT NULL,
	"referee_reward_points" integer DEFAULT 0 NOT NULL,
	"reward_status" text DEFAULT 'pending' NOT NULL,
	"reward_issued_at" timestamp,
	"fraud_flag_reason" text,
	"idempotency_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_referrals_referee_customer_id_unique" UNIQUE("referee_customer_id"),
	CONSTRAINT "customer_referrals_idempotency_key_unique" UNIQUE("idempotency_key")
);

CREATE TABLE IF NOT EXISTS "loyalty_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"city_id" integer,
	"branch_id" integer,
	"transaction_type" text NOT NULL,
	"points" integer NOT NULL,
	"rupee_equivalent" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"balance_after" integer NOT NULL,
	"source_reference" text NOT NULL,
	"booking_id" integer,
	"referral_id" integer,
	"reversal_of_id" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"consumed_points" integer DEFAULT 0 NOT NULL,
	"idempotency_key" text,
	"expires_at" timestamp,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_ledger_idempotency_key_unique" UNIQUE("idempotency_key")
);

CREATE TABLE IF NOT EXISTS "loyalty_programs_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city_id" integer,
	"branch_id" integer,
	"points_per_100_spent" integer DEFAULT 5 NOT NULL,
	"first_booking_bonus_points" integer DEFAULT 50 NOT NULL,
	"referrer_reward_points" integer DEFAULT 200 NOT NULL,
	"referee_reward_points" integer DEFAULT 100 NOT NULL,
	"redemption_rupees_per_point" numeric(10, 2) DEFAULT '1.00' NOT NULL,
	"min_redemption_points" integer DEFAULT 50 NOT NULL,
	"max_redemption_points_per_order" integer DEFAULT 500 NOT NULL,
	"max_redemption_percentage_order" integer DEFAULT 50 NOT NULL,
	"points_validity_days" integer DEFAULT 180 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "retention_automations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"trigger_type" text NOT NULL,
	"delay_days" integer DEFAULT 7 NOT NULL,
	"city_id" integer,
	"branch_id" integer,
	"service_id" integer,
	"coupon_code" text,
	"reward_points" integer DEFAULT 0 NOT NULL,
	"title_template" text NOT NULL,
	"message_template" text NOT NULL,
	"frequency_cap_days" integer DEFAULT 30 NOT NULL,
	"channel" text DEFAULT 'in_app' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"total_evaluated_count" integer DEFAULT 0 NOT NULL,
	"total_triggered_count" integer DEFAULT 0 NOT NULL,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "retention_execution_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"automation_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"city_id" integer,
	"channel" text NOT NULL,
	"notification_id" integer,
	"status" text NOT NULL,
	"message_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "job_execution_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"job_key" text NOT NULL,
	"job_type" text NOT NULL,
	"city_id" integer,
	"branch_id" integer,
	"status" text NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"trigger_type" text DEFAULT 'scheduled' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer,
	"worker_id" text,
	"sanitized_payload" jsonb,
	"result_summary" jsonb,
	"error_message" text,
	"error_stack" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "scheduled_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"job_type" text NOT NULL,
	"schedule_type" text DEFAULT 'recurring_interval' NOT NULL,
	"cron_expression" text,
	"interval_seconds" integer,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"city_id" integer,
	"branch_id" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"run_at" timestamp,
	"next_run_at" timestamp,
	"last_run_at" timestamp,
	"last_run_status" text,
	"last_run_duration_ms" integer,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"backoff_base_seconds" integer DEFAULT 30 NOT NULL,
	"backoff_max_seconds" integer DEFAULT 3600 NOT NULL,
	"idempotency_key" text,
	"locked_by" text,
	"locked_at" timestamp,
	"lease_expires_at" timestamp,
	"last_error" text,
	"error_details" jsonb,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"alert_threshold_failures" integer DEFAULT 3 NOT NULL,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scheduled_jobs_job_key_unique" UNIQUE("job_key"),
	CONSTRAINT "scheduled_jobs_idempotency_key_unique" UNIQUE("idempotency_key")
);

CREATE TABLE IF NOT EXISTS "worker_heartbeats" (
	"worker_id" text PRIMARY KEY NOT NULL,
	"hostname" text,
	"pid" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"concurrency" integer DEFAULT 5 NOT NULL,
	"active_jobs_count" integer DEFAULT 0 NOT NULL,
	"last_heartbeat_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);

CREATE TABLE IF NOT EXISTS "ux_experiment_exposures" (
	"id" serial PRIMARY KEY NOT NULL,
	"experiment_id" integer NOT NULL,
	"variant_id" varchar(64) NOT NULL,
	"session_id" text NOT NULL,
	"customer_id" integer,
	"city_id" integer,
	"device_type" varchar(32) DEFAULT 'mobile',
	"first_exposed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"converted" boolean DEFAULT false NOT NULL,
	"conversion_event" varchar(64),
	"converted_at" timestamp with time zone,
	"conversion_value" numeric(10, 2),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "uq_exp_session" UNIQUE("experiment_id","session_id")
);

CREATE TABLE IF NOT EXISTS "ux_experiments" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"target_screen" varchar(64) DEFAULT 'homepage' NOT NULL,
	"city_id" integer,
	"branch_id" integer,
	"service_id" integer,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"traffic_allocation" integer DEFAULT 100 NOT NULL,
	"primary_metric" varchar(64) DEFAULT 'booking_confirmed' NOT NULL,
	"winner_variant_id" varchar(64),
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_experiments_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "service_exceptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"exception_code" text NOT NULL,
	"category" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	"details" jsonb,
	"booking_id" integer,
	"customer_id" integer,
	"staff_id" integer,
	"execution_id" integer,
	"subscription_id" integer,
	"complaint_id" integer,
	"city_id" integer,
	"branch_id" integer,
	"company_id" integer,
	"dedupe_key" text,
	"evidence_url" text,
	"acknowledged_at" timestamp,
	"acknowledged_by" integer,
	"resolved_at" timestamp,
	"resolved_by" integer,
	"resolution_notes" text,
	"resolution_action" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payment_refunds" (
	"id" serial PRIMARY KEY NOT NULL,
	"refund_id" text NOT NULL,
	"payment_id" integer,
	"attempt_id" integer,
	"customer_id" integer NOT NULL,
	"booking_id" integer,
	"invoice_id" integer,
	"city_id" integer,
	"branch_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'initiated' NOT NULL,
	"gateway_provider" text DEFAULT 'cashfree' NOT NULL,
	"cf_refund_id" text,
	"rzp_refund_id" text,
	"gateway_refund_id" text,
	"raw_gateway_payload" jsonb,
	"initiated_by_user_id" integer,
	"processed_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_refunds_refund_id_unique" UNIQUE("refund_id")
);

CREATE TABLE IF NOT EXISTS "payment_webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"gateway_provider" text DEFAULT 'razorpay' NOT NULL,
	"event_type" text NOT NULL,
	"order_id" text,
	"payment_id" text,
	"payload" jsonb,
	"status" text DEFAULT 'processed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_webhook_events_event_id_unique" UNIQUE("event_id")
);

CREATE TABLE IF NOT EXISTS "operating_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope_type" text DEFAULT 'global' NOT NULL,
	"city_id" integer,
	"branch_id" integer,
	"day_of_week" integer NOT NULL,
	"is_working_day" boolean DEFAULT true NOT NULL,
	"open_time" text DEFAULT '08:00' NOT NULL,
	"close_time" text DEFAULT '18:00' NOT NULL,
	"slot_step_minutes" integer DEFAULT 15 NOT NULL,
	"max_concurrent_slots" integer DEFAULT 8 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "operational_closures" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"customer_reason" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_full_day" boolean DEFAULT true NOT NULL,
	"start_time" text,
	"end_time" text,
	"scope_type" text DEFAULT 'global' NOT NULL,
	"city_id" integer,
	"branch_id" integer,
	"exempt_segments" jsonb DEFAULT '["daily_cleaning"]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "geographic_localities" (
	"id" serial PRIMARY KEY NOT NULL,
	"city_id" integer NOT NULL,
	"service_area_id" integer,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"code" text,
	"pincode" text,
	"latitude" double precision,
	"longitude" double precision,
	"boundary_geojson" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "location_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"alias" text NOT NULL,
	"normalized_alias" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "branch_zone_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"zone_id" integer NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_until" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "operational_zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"city_id" integer NOT NULL,
	"branch_id" integer,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"center_latitude" double precision,
	"center_longitude" double precision,
	"radius_meters" integer,
	"boundary_geojson" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_zones_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "zone_coverage_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"zone_id" integer NOT NULL,
	"branch_id" integer,
	"coverage_type" text NOT NULL,
	"society_id" integer,
	"locality_id" integer,
	"pincode" text,
	"property_type" text DEFAULT 'ALL' NOT NULL,
	"service_id" integer,
	"status" text DEFAULT 'serviceable' NOT NULL,
	"rejection_reason" text,
	"priority" integer DEFAULT 10 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "location_pricing_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"package_id" integer,
	"city_id" integer NOT NULL,
	"branch_id" integer,
	"zone_id" integer,
	"society_id" integer,
	"location_type" text DEFAULT 'ALL' NOT NULL,
	"vehicle_category_id" integer,
	"base_price" numeric(10, 2) NOT NULL,
	"gst_rate" numeric(5, 2) DEFAULT '18' NOT NULL,
	"pricing_type" text DEFAULT 'inclusive' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_until" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pricing_rule_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" integer NOT NULL,
	"action" text NOT NULL,
	"previous_values" jsonb,
	"new_values" jsonb,
	"changed_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "branch_user_assignments" ADD CONSTRAINT "branch_user_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "branch_user_assignments" ADD CONSTRAINT "branch_user_assignments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "branch_user_assignments" ADD CONSTRAINT "branch_user_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "service_branch_overrides" ADD CONSTRAINT "service_branch_overrides_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "service_branch_overrides" ADD CONSTRAINT "service_branch_overrides_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_documents" ADD CONSTRAINT "staff_documents_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_documents" ADD CONSTRAINT "staff_documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_notes" ADD CONSTRAINT "staff_notes_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_notes" ADD CONSTRAINT "staff_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_role_assignments" ADD CONSTRAINT "staff_role_assignments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_role_assignments" ADD CONSTRAINT "staff_role_assignments_role_id_staff_role_master_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."staff_role_master"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "booking_snapshots" ADD CONSTRAINT "booking_snapshots_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "booking_timeline" ADD CONSTRAINT "booking_timeline_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "legal_page_versions" ADD CONSTRAINT "legal_page_versions_page_id_legal_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."legal_pages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "address_history" ADD CONSTRAINT "address_history_identity_id_address_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."address_identities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "address_history" ADD CONSTRAINT "address_history_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "address_identities" ADD CONSTRAINT "address_identities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "address_legacy_links" ADD CONSTRAINT "address_legacy_links_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "address_legacy_links" ADD CONSTRAINT "address_legacy_links_identity_id_address_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."address_identities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "address_snapshots" ADD CONSTRAINT "address_snapshots_identity_id_address_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."address_identities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "address_snapshots" ADD CONSTRAINT "address_snapshots_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "addresses" ADD CONSTRAINT "addresses_identity_id_address_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."address_identities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "addresses" ADD CONSTRAINT "addresses_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "addresses" ADD CONSTRAINT "addresses_state_id_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "assets" ADD CONSTRAINT "assets_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "assets" ADD CONSTRAINT "assets_solar_site_id_solar_sites_id_fk" FOREIGN KEY ("solar_site_id") REFERENCES "public"."solar_sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "migration_batches" ADD CONSTRAINT "migration_batches_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "migration_entity_map" ADD CONSTRAINT "migration_entity_map_batch_id_migration_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."migration_batches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "migration_row_log" ADD CONSTRAINT "migration_row_log_batch_id_migration_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."migration_batches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "push_notifications" ADD CONSTRAINT "push_notifications_notification_event_id_notification_events_id_fk" FOREIGN KEY ("notification_event_id") REFERENCES "public"."notification_events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "promotions" ADD CONSTRAINT "promotions_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "promotions" ADD CONSTRAINT "promotions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "promotions" ADD CONSTRAINT "promotions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "city_landing_pages" ADD CONSTRAINT "city_landing_pages_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "city_landing_pages" ADD CONSTRAINT "city_landing_pages_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "homepage_sections" ADD CONSTRAINT "homepage_sections_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "homepage_sections" ADD CONSTRAINT "homepage_sections_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_banner_id_promotions_id_fk" FOREIGN KEY ("banner_id") REFERENCES "public"."promotions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketing_media_assets" ADD CONSTRAINT "marketing_media_assets_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketing_media_assets" ADD CONSTRAINT "marketing_media_assets_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_payout_ledgers" ADD CONSTRAINT "staff_payout_ledgers_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_payout_ledgers" ADD CONSTRAINT "staff_payout_ledgers_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_payout_ledgers" ADD CONSTRAINT "staff_payout_ledgers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_payout_ledgers" ADD CONSTRAINT "staff_payout_ledgers_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_payout_ledgers" ADD CONSTRAINT "staff_payout_ledgers_disbursed_by_users_id_fk" FOREIGN KEY ("disbursed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_referrer_customer_id_customers_id_fk" FOREIGN KEY ("referrer_customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_referee_customer_id_customers_id_fk" FOREIGN KEY ("referee_customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_attributed_booking_id_bookings_id_fk" FOREIGN KEY ("attributed_booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_referral_id_customer_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."customer_referrals"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "loyalty_programs_config" ADD CONSTRAINT "loyalty_programs_config_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "loyalty_programs_config" ADD CONSTRAINT "loyalty_programs_config_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "retention_automations" ADD CONSTRAINT "retention_automations_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "retention_automations" ADD CONSTRAINT "retention_automations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "retention_automations" ADD CONSTRAINT "retention_automations_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "retention_execution_logs" ADD CONSTRAINT "retention_execution_logs_automation_id_retention_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."retention_automations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "retention_execution_logs" ADD CONSTRAINT "retention_execution_logs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "retention_execution_logs" ADD CONSTRAINT "retention_execution_logs_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "retention_execution_logs" ADD CONSTRAINT "retention_execution_logs_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "job_execution_history" ADD CONSTRAINT "job_execution_history_job_id_scheduled_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scheduled_jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "job_execution_history" ADD CONSTRAINT "job_execution_history_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "job_execution_history" ADD CONSTRAINT "job_execution_history_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ux_experiment_exposures" ADD CONSTRAINT "ux_experiment_exposures_experiment_id_ux_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."ux_experiments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ux_experiment_exposures" ADD CONSTRAINT "ux_experiment_exposures_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ux_experiment_exposures" ADD CONSTRAINT "ux_experiment_exposures_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ux_experiments" ADD CONSTRAINT "ux_experiments_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ux_experiments" ADD CONSTRAINT "ux_experiments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ux_experiments" ADD CONSTRAINT "ux_experiments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_initiated_by_user_id_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "operating_hours" ADD CONSTRAINT "operating_hours_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "operating_hours" ADD CONSTRAINT "operating_hours_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "operational_closures" ADD CONSTRAINT "operational_closures_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "operational_closures" ADD CONSTRAINT "operational_closures_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "operational_closures" ADD CONSTRAINT "operational_closures_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "geographic_localities" ADD CONSTRAINT "geographic_localities_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "geographic_localities" ADD CONSTRAINT "geographic_localities_service_area_id_service_areas_id_fk" FOREIGN KEY ("service_area_id") REFERENCES "public"."service_areas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "branch_zone_mappings" ADD CONSTRAINT "branch_zone_mappings_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "branch_zone_mappings" ADD CONSTRAINT "branch_zone_mappings_zone_id_operational_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."operational_zones"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "operational_zones" ADD CONSTRAINT "operational_zones_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "operational_zones" ADD CONSTRAINT "operational_zones_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "zone_coverage_rules" ADD CONSTRAINT "zone_coverage_rules_zone_id_operational_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."operational_zones"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "zone_coverage_rules" ADD CONSTRAINT "zone_coverage_rules_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "zone_coverage_rules" ADD CONSTRAINT "zone_coverage_rules_society_id_residential_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."residential_societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "zone_coverage_rules" ADD CONSTRAINT "zone_coverage_rules_locality_id_geographic_localities_id_fk" FOREIGN KEY ("locality_id") REFERENCES "public"."geographic_localities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "zone_coverage_rules" ADD CONSTRAINT "zone_coverage_rules_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "location_pricing_rules" ADD CONSTRAINT "location_pricing_rules_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "location_pricing_rules" ADD CONSTRAINT "location_pricing_rules_package_id_catalog_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."catalog_packages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "location_pricing_rules" ADD CONSTRAINT "location_pricing_rules_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "location_pricing_rules" ADD CONSTRAINT "location_pricing_rules_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "location_pricing_rules" ADD CONSTRAINT "location_pricing_rules_zone_id_operational_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."operational_zones"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "location_pricing_rules" ADD CONSTRAINT "location_pricing_rules_society_id_residential_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."residential_societies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "location_pricing_rules" ADD CONSTRAINT "location_pricing_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "pricing_rule_audit_logs" ADD CONSTRAINT "pricing_rule_audit_logs_rule_id_location_pricing_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."location_pricing_rules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "pricing_rule_audit_logs" ADD CONSTRAINT "pricing_rule_audit_logs_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "customer_contracts_source_unique" ON "customer_contracts" USING btree ("source_system","source_id");

CREATE INDEX IF NOT EXISTS "idx_customer_contracts_customer" ON "customer_contracts" USING btree ("customer_id");

CREATE INDEX IF NOT EXISTS "idx_customer_contracts_status" ON "customer_contracts" USING btree ("status");

CREATE INDEX IF NOT EXISTS "idx_customer_contracts_product" ON "customer_contracts" USING btree ("product_line");

CREATE INDEX IF NOT EXISTS "idx_pending_assignments_customer" ON "pending_service_assignments" USING btree ("customer_id");

CREATE INDEX IF NOT EXISTS "idx_pending_assignments_status" ON "pending_service_assignments" USING btree ("status");

CREATE UNIQUE INDEX IF NOT EXISTS "service_assignments_pending_task_unique" ON "service_assignments" USING btree ("pending_assignment_id","task_type");

CREATE INDEX IF NOT EXISTS "idx_service_assignments_task_type" ON "service_assignments" USING btree ("task_type");

CREATE INDEX IF NOT EXISTS "idx_service_assignments_status" ON "service_assignments" USING btree ("status");

CREATE INDEX IF NOT EXISTS "idx_service_assignments_staff" ON "service_assignments" USING btree ("assigned_staff_id");

CREATE INDEX IF NOT EXISTS "idx_service_assignments_location" ON "service_assignments" USING btree ("service_location_id");

CREATE INDEX IF NOT EXISTS "idx_service_assignments_contract" ON "service_assignments" USING btree ("contract_id");

CREATE INDEX IF NOT EXISTS "idx_service_assignments_booking" ON "service_assignments" USING btree ("booking_id");

CREATE INDEX IF NOT EXISTS "idx_assignment_timeline_assignment" ON "assignment_timeline" USING btree ("assignment_id");

CREATE INDEX IF NOT EXISTS "idx_assignment_timeline_pending" ON "assignment_timeline" USING btree ("pending_assignment_id");

CREATE INDEX IF NOT EXISTS "idx_assignment_timeline_event" ON "assignment_timeline" USING btree ("event_type");

CREATE INDEX IF NOT EXISTS "idx_service_execution_checklist_execution" ON "service_execution_checklist_items" USING btree ("execution_id");

CREATE INDEX IF NOT EXISTS "idx_service_execution_location_execution" ON "service_execution_location_logs" USING btree ("execution_id");

CREATE INDEX IF NOT EXISTS "idx_service_execution_notes_execution" ON "service_execution_notes" USING btree ("execution_id");

CREATE INDEX IF NOT EXISTS "idx_service_execution_photos_execution" ON "service_execution_photos" USING btree ("execution_id");

CREATE INDEX IF NOT EXISTS "idx_service_executions_assignment" ON "service_executions" USING btree ("service_assignment_id");

CREATE INDEX IF NOT EXISTS "idx_service_executions_staff_date" ON "service_executions" USING btree ("assigned_staff_id","scheduled_date");

CREATE INDEX IF NOT EXISTS "idx_service_executions_task_type" ON "service_executions" USING btree ("task_type");

CREATE INDEX IF NOT EXISTS "idx_service_executions_status" ON "service_executions" USING btree ("status");

CREATE INDEX IF NOT EXISTS "idx_service_executions_customer" ON "service_executions" USING btree ("customer_id");

CREATE INDEX IF NOT EXISTS "idx_service_executions_scheduled_date" ON "service_executions" USING btree ("scheduled_date");

CREATE INDEX IF NOT EXISTS "idx_service_executions_ops_status" ON "service_executions" USING btree ("ops_status");

CREATE INDEX IF NOT EXISTS "idx_service_executions_priority" ON "service_executions" USING btree ("priority");

CREATE INDEX IF NOT EXISTS "idx_service_executions_escalated" ON "service_executions" USING btree ("is_escalated");

CREATE INDEX IF NOT EXISTS "idx_service_executions_depends_on" ON "service_executions" USING btree ("depends_on_execution_id");

CREATE INDEX IF NOT EXISTS "idx_execution_timeline_execution" ON "execution_timeline" USING btree ("execution_id");

CREATE INDEX IF NOT EXISTS "idx_execution_timeline_event" ON "execution_timeline" USING btree ("event_type");

CREATE INDEX IF NOT EXISTS "idx_job_orch_timeline_execution" ON "job_orchestration_timeline" USING btree ("execution_id");

CREATE INDEX IF NOT EXISTS "idx_job_orch_timeline_event" ON "job_orchestration_timeline" USING btree ("event_type");

CREATE INDEX IF NOT EXISTS "idx_billing_commercial_timeline_invoice" ON "billing_commercial_timeline" USING btree ("invoice_id");

CREATE INDEX IF NOT EXISTS "idx_billing_commercial_timeline_execution" ON "billing_commercial_timeline" USING btree ("execution_id");

CREATE INDEX IF NOT EXISTS "idx_billing_commercial_timeline_event" ON "billing_commercial_timeline" USING btree ("event_type");

CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" USING btree ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "permissions_role_resource_action_idx" ON "permissions" USING btree ("role","resource","action");

CREATE INDEX IF NOT EXISTS "idx_branch_user_assignments_user_active" ON "branch_user_assignments" USING btree ("user_id","is_active");

CREATE INDEX IF NOT EXISTS "idx_branch_user_assignments_branch_active" ON "branch_user_assignments" USING btree ("branch_id","is_active");

CREATE INDEX IF NOT EXISTS "idx_branch_user_assignments_user_branch" ON "branch_user_assignments" USING btree ("user_id","branch_id");

CREATE UNIQUE INDEX IF NOT EXISTS "service_branch_overrides_service_branch_unique" ON "service_branch_overrides" USING btree ("service_id","branch_id");

CREATE INDEX IF NOT EXISTS "idx_service_branch_overrides_branch" ON "service_branch_overrides" USING btree ("branch_id");

CREATE INDEX IF NOT EXISTS "idx_service_branch_overrides_service" ON "service_branch_overrides" USING btree ("service_id");

CREATE INDEX IF NOT EXISTS "bookings_scheduled_date_idx" ON "bookings" USING btree ("scheduled_date");

CREATE INDEX IF NOT EXISTS "bookings_branch_date_idx" ON "bookings" USING btree ("branch_id","scheduled_date");

CREATE INDEX IF NOT EXISTS "bookings_customer_date_idx" ON "bookings" USING btree ("customer_id","scheduled_date");

CREATE INDEX IF NOT EXISTS "bookings_asset_date_idx" ON "bookings" USING btree ("asset_id","scheduled_date");

CREATE INDEX IF NOT EXISTS "bookings_status_idx" ON "bookings" USING btree ("status");

CREATE INDEX IF NOT EXISTS "bookings_assigned_staff_idx" ON "bookings" USING btree ("assigned_staff_id");

CREATE INDEX IF NOT EXISTS "bookings_contract_registry_idx" ON "bookings" USING btree ("contract_registry_id");

CREATE INDEX IF NOT EXISTS "bookings_start_at_idx" ON "bookings" USING btree ("scheduled_start_at");

CREATE INDEX IF NOT EXISTS "bookings_type_idx" ON "bookings" USING btree ("booking_type");

CREATE INDEX IF NOT EXISTS "bookings_rescheduled_from_idx" ON "bookings" USING btree ("rescheduled_from_booking_id");

CREATE INDEX IF NOT EXISTS "bookings_rescheduled_to_idx" ON "bookings" USING btree ("rescheduled_to_booking_id");

CREATE INDEX IF NOT EXISTS "makeup_approvals_status_idx" ON "makeup_approval_requests" USING btree ("status");

CREATE INDEX IF NOT EXISTS "makeup_approvals_city_branch_idx" ON "makeup_approval_requests" USING btree ("city_id","branch_id");

CREATE INDEX IF NOT EXISTS "makeup_approvals_booking_idx" ON "makeup_approval_requests" USING btree ("booking_id");

CREATE INDEX IF NOT EXISTS "makeup_approvals_customer_idx" ON "makeup_approval_requests" USING btree ("customer_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_complaints_ticket_number" ON "complaints" USING btree ("ticket_number");

CREATE INDEX IF NOT EXISTS "idx_complaints_customer_status" ON "complaints" USING btree ("customer_id","status");

CREATE INDEX IF NOT EXISTS "idx_complaints_city" ON "complaints" USING btree ("city_id");

CREATE INDEX IF NOT EXISTS "idx_complaints_branch" ON "complaints" USING btree ("branch_id");

CREATE INDEX IF NOT EXISTS "idx_complaints_sub" ON "complaints" USING btree ("subscription_id");

CREATE INDEX IF NOT EXISTS "idx_sla_escalation_complaint" ON "sla_escalation_logs" USING btree ("complaint_id");

CREATE INDEX IF NOT EXISTS "idx_sla_escalation_level" ON "sla_escalation_logs" USING btree ("escalation_level");

CREATE INDEX IF NOT EXISTS "idx_sla_policies_city" ON "sla_policies" USING btree ("city_id");

CREATE INDEX IF NOT EXISTS "idx_sla_policies_priority" ON "sla_policies" USING btree ("priority");

CREATE INDEX IF NOT EXISTS "idx_sla_policies_active" ON "sla_policies" USING btree ("is_active");

CREATE INDEX IF NOT EXISTS "idx_ticket_messages_complaint" ON "support_ticket_messages" USING btree ("complaint_id","created_at");

CREATE INDEX IF NOT EXISTS "payment_attempts_customer_id_idx" ON "payment_attempts" USING btree ("customer_id");

CREATE INDEX IF NOT EXISTS "payment_attempts_invoice_id_idx" ON "payment_attempts" USING btree ("invoice_id");

CREATE INDEX IF NOT EXISTS "payment_attempts_booking_id_idx" ON "payment_attempts" USING btree ("booking_id");

CREATE INDEX IF NOT EXISTS "payment_attempts_subscription_id_idx" ON "payment_attempts" USING btree ("subscription_id");

CREATE INDEX IF NOT EXISTS "payment_attempts_city_id_idx" ON "payment_attempts" USING btree ("city_id");

CREATE INDEX IF NOT EXISTS "payment_attempts_branch_id_idx" ON "payment_attempts" USING btree ("branch_id");

CREATE INDEX IF NOT EXISTS "payment_attempts_status_idx" ON "payment_attempts" USING btree ("status");

CREATE INDEX IF NOT EXISTS "payment_attempts_refund_status_idx" ON "payment_attempts" USING btree ("refund_status");

CREATE INDEX IF NOT EXISTS "payment_attempts_reconciliation_status_idx" ON "payment_attempts" USING btree ("reconciliation_status");

CREATE INDEX IF NOT EXISTS "payment_attempts_attempt_id_idx" ON "payment_attempts" USING btree ("attempt_id");

CREATE INDEX IF NOT EXISTS "payment_attempts_cf_order_id_idx" ON "payment_attempts" USING btree ("cf_order_id");

CREATE INDEX IF NOT EXISTS "payment_attempts_rzp_order_id_idx" ON "payment_attempts" USING btree ("rzp_order_id");

CREATE INDEX IF NOT EXISTS "payment_attempts_gateway_provider_idx" ON "payment_attempts" USING btree ("gateway_provider");

CREATE INDEX IF NOT EXISTS "payment_attempts_gateway_order_id_idx" ON "payment_attempts" USING btree ("gateway_order_id");

CREATE INDEX IF NOT EXISTS "payment_attempts_idempotency_key_idx" ON "payment_attempts" USING btree ("idempotency_key");

CREATE INDEX IF NOT EXISTS "idx_notifications_user_read" ON "notifications" USING btree ("user_id","is_read");

CREATE INDEX IF NOT EXISTS "idx_notifications_customer_read" ON "notifications" USING btree ("customer_id","is_read");

CREATE INDEX IF NOT EXISTS "idx_notifications_city" ON "notifications" USING btree ("city_id");

CREATE INDEX IF NOT EXISTS "idx_notifications_dedupe" ON "notifications" USING btree ("dedupe_key");

CREATE INDEX IF NOT EXISTS "comm_attr_campaign_idx" ON "comm_campaign_attribution" USING btree ("campaign_id");

CREATE INDEX IF NOT EXISTS "comm_attr_customer_idx" ON "comm_campaign_attribution" USING btree ("customer_id");

CREATE INDEX IF NOT EXISTS "comm_attr_campaign_customer_idx" ON "comm_campaign_attribution" USING btree ("campaign_id","customer_id");

CREATE UNIQUE INDEX IF NOT EXISTS "comm_customer_consents_customer_idx" ON "comm_customer_consents" USING btree ("customer_id");

CREATE INDEX IF NOT EXISTS "comm_customer_consents_company_idx" ON "comm_customer_consents" USING btree ("company_id");

CREATE INDEX IF NOT EXISTS "comm_events_campaign_idx" ON "comm_events" USING btree ("campaign_id");

CREATE INDEX IF NOT EXISTS "comm_events_customer_idx" ON "comm_events" USING btree ("customer_id");

CREATE INDEX IF NOT EXISTS "comm_events_status_idx" ON "comm_events" USING btree ("status");

CREATE INDEX IF NOT EXISTS "comm_events_created_idx" ON "comm_events" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "comm_events_company_created_idx" ON "comm_events" USING btree ("company_id","created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "comm_smart_segments_key_company_idx" ON "comm_smart_segments" USING btree ("segment_key","company_id");

CREATE INDEX IF NOT EXISTS "comm_smart_segments_active_idx" ON "comm_smart_segments" USING btree ("active");

CREATE INDEX IF NOT EXISTS "comm_ai_rec_brand_type_idx" ON "comm_ai_recommendations" USING btree ("brand_id","recommendation_type");

CREATE UNIQUE INDEX IF NOT EXISTS "comm_brands_code_company_idx" ON "comm_brands" USING btree ("code","company_id");

CREATE INDEX IF NOT EXISTS "comm_brands_status_idx" ON "comm_brands" USING btree ("status");

CREATE INDEX IF NOT EXISTS "comm_consent_history_customer_idx" ON "comm_consent_history" USING btree ("customer_id","created_at");

CREATE INDEX IF NOT EXISTS "comm_dead_letter_brand_idx" ON "comm_dead_letter" USING btree ("brand_id");

CREATE INDEX IF NOT EXISTS "comm_dead_letter_created_idx" ON "comm_dead_letter" USING btree ("created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "comm_dlt_templates_brand_template_idx" ON "comm_dlt_templates" USING btree ("brand_id","template_id");

CREATE INDEX IF NOT EXISTS "comm_dlt_templates_brand_idx" ON "comm_dlt_templates" USING btree ("brand_id");

CREATE INDEX IF NOT EXISTS "comm_dlt_templates_status_idx" ON "comm_dlt_templates" USING btree ("status");

CREATE INDEX IF NOT EXISTS "comm_email_templates_brand_idx" ON "comm_email_templates" USING btree ("brand_id");

CREATE INDEX IF NOT EXISTS "comm_queue_jobs_status_retry_idx" ON "comm_queue_jobs" USING btree ("status","next_retry_at");

CREATE INDEX IF NOT EXISTS "comm_queue_jobs_queue_idx" ON "comm_queue_jobs" USING btree ("queue_name","status");

CREATE INDEX IF NOT EXISTS "comm_queue_jobs_event_idx" ON "comm_queue_jobs" USING btree ("event_id");

CREATE INDEX IF NOT EXISTS "comm_timeline_customer_idx" ON "comm_timeline" USING btree ("customer_id","created_at");

CREATE INDEX IF NOT EXISTS "comm_timeline_brand_idx" ON "comm_timeline" USING btree ("brand_id");

CREATE INDEX IF NOT EXISTS "comm_timeline_campaign_idx" ON "comm_timeline" USING btree ("campaign_id");

CREATE INDEX IF NOT EXISTS "comm_timeline_created_idx" ON "comm_timeline" USING btree ("created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "comm_wa_templates_brand_name_idx" ON "comm_whatsapp_templates" USING btree ("brand_id","meta_template_name","language");

CREATE INDEX IF NOT EXISTS "comm_wa_templates_brand_idx" ON "comm_whatsapp_templates" USING btree ("brand_id");

CREATE INDEX IF NOT EXISTS "comm_workflow_runs_workflow_idx" ON "comm_workflow_runs" USING btree ("workflow_id");

CREATE INDEX IF NOT EXISTS "comm_workflow_runs_customer_idx" ON "comm_workflow_runs" USING btree ("customer_id");

CREATE INDEX IF NOT EXISTS "comm_workflow_runs_status_idx" ON "comm_workflow_runs" USING btree ("status");

CREATE INDEX IF NOT EXISTS "comm_workflow_steps_workflow_idx" ON "comm_workflow_steps" USING btree ("workflow_id","step_order");

CREATE INDEX IF NOT EXISTS "comm_workflows_brand_trigger_idx" ON "comm_workflows" USING btree ("brand_id","trigger");

CREATE UNIQUE INDEX IF NOT EXISTS "comm_agent_metrics_user_date_idx" ON "comm_agent_metrics" USING btree ("user_id","period_date","company_id");

CREATE INDEX IF NOT EXISTS "comm_ai_assist_conversation_idx" ON "comm_ai_assistance" USING btree ("conversation_id");

CREATE INDEX IF NOT EXISTS "comm_channel_costs_campaign_idx" ON "comm_channel_costs" USING btree ("campaign_id");

CREATE INDEX IF NOT EXISTS "comm_channel_costs_brand_channel_idx" ON "comm_channel_costs" USING btree ("brand_id","channel");

CREATE INDEX IF NOT EXISTS "comm_conv_msg_conversation_idx" ON "comm_conversation_messages" USING btree ("conversation_id","created_at");

CREATE INDEX IF NOT EXISTS "comm_conv_msg_provider_idx" ON "comm_conversation_messages" USING btree ("provider_message_id");

CREATE INDEX IF NOT EXISTS "comm_conv_notes_conversation_idx" ON "comm_conversation_notes" USING btree ("conversation_id","created_at");

CREATE INDEX IF NOT EXISTS "comm_conv_tags_conversation_idx" ON "comm_conversation_tags" USING btree ("conversation_id");

CREATE INDEX IF NOT EXISTS "comm_conv_tags_tag_idx" ON "comm_conversation_tags" USING btree ("tag");

CREATE INDEX IF NOT EXISTS "comm_conv_customer_idx" ON "comm_conversations" USING btree ("customer_id","last_message_at");

CREATE INDEX IF NOT EXISTS "comm_conv_status_idx" ON "comm_conversations" USING btree ("status","last_message_at");

CREATE INDEX IF NOT EXISTS "comm_conv_assigned_user_idx" ON "comm_conversations" USING btree ("assigned_to_user_id","status");

CREATE INDEX IF NOT EXISTS "comm_conv_assigned_team_idx" ON "comm_conversations" USING btree ("assigned_team_id","status");

CREATE INDEX IF NOT EXISTS "comm_conv_brand_idx" ON "comm_conversations" USING btree ("brand_id");

CREATE INDEX IF NOT EXISTS "comm_conv_unknown_idx" ON "comm_conversations" USING btree ("is_unknown_contact","status");

CREATE INDEX IF NOT EXISTS "comm_conv_email_thread_idx" ON "comm_conversations" USING btree ("email_thread_id");

CREATE INDEX IF NOT EXISTS "comm_csat_conversation_idx" ON "comm_csat_responses" USING btree ("conversation_id");

CREATE INDEX IF NOT EXISTS "comm_csat_agent_idx" ON "comm_csat_responses" USING btree ("agent_user_id");

CREATE INDEX IF NOT EXISTS "comm_journey_customer_idx" ON "comm_journey_events" USING btree ("customer_id","occurred_at");

CREATE INDEX IF NOT EXISTS "comm_journey_lead_idx" ON "comm_journey_events" USING btree ("lead_id","occurred_at");

CREATE INDEX IF NOT EXISTS "comm_journey_type_idx" ON "comm_journey_events" USING btree ("event_type");

CREATE INDEX IF NOT EXISTS "comm_kb_category_idx" ON "comm_knowledge_base" USING btree ("category");

CREATE INDEX IF NOT EXISTS "comm_kb_brand_idx" ON "comm_knowledge_base" USING btree ("brand_id");

CREATE UNIQUE INDEX IF NOT EXISTS "comm_link_tracking_id_idx" ON "comm_link_tracking" USING btree ("tracking_id");

CREATE INDEX IF NOT EXISTS "comm_link_campaign_idx" ON "comm_link_tracking" USING btree ("campaign_id");

CREATE INDEX IF NOT EXISTS "comm_link_customer_idx" ON "comm_link_tracking" USING btree ("customer_id");

CREATE UNIQUE INDEX IF NOT EXISTS "comm_teams_code_company_idx" ON "comm_teams" USING btree ("code","company_id");

CREATE INDEX IF NOT EXISTS "comm_unknown_phone_idx" ON "comm_unknown_contacts" USING btree ("phone");

CREATE INDEX IF NOT EXISTS "comm_unknown_status_idx" ON "comm_unknown_contacts" USING btree ("status");

CREATE INDEX IF NOT EXISTS "saved_locations_customer_idx" ON "saved_locations" USING btree ("customer_id");

CREATE INDEX IF NOT EXISTS "saved_locations_customer_default_idx" ON "saved_locations" USING btree ("customer_id","is_default");

CREATE INDEX IF NOT EXISTS "saved_locations_place_id_idx" ON "saved_locations" USING btree ("place_id");

CREATE INDEX IF NOT EXISTS "address_history_identity_idx" ON "address_history" USING btree ("identity_id");

CREATE INDEX IF NOT EXISTS "address_history_customer_idx" ON "address_history" USING btree ("customer_id");

CREATE INDEX IF NOT EXISTS "address_history_address_idx" ON "address_history" USING btree ("address_id");

CREATE INDEX IF NOT EXISTS "address_identities_customer_idx" ON "address_identities" USING btree ("customer_id");

CREATE INDEX IF NOT EXISTS "address_identities_fingerprint_idx" ON "address_identities" USING btree ("fingerprint");

CREATE INDEX IF NOT EXISTS "address_identities_place_id_idx" ON "address_identities" USING btree ("canonical_place_id");

CREATE UNIQUE INDEX IF NOT EXISTS "address_legacy_links_unique" ON "address_legacy_links" USING btree ("legacy_table","legacy_id");

CREATE INDEX IF NOT EXISTS "address_legacy_links_address_idx" ON "address_legacy_links" USING btree ("address_id");

CREATE INDEX IF NOT EXISTS "address_snapshots_identity_idx" ON "address_snapshots" USING btree ("identity_id");

CREATE INDEX IF NOT EXISTS "address_snapshots_customer_idx" ON "address_snapshots" USING btree ("customer_id");

CREATE INDEX IF NOT EXISTS "address_snapshots_address_idx" ON "address_snapshots" USING btree ("address_id");

CREATE INDEX IF NOT EXISTS "addresses_customer_idx" ON "addresses" USING btree ("customer_id");

CREATE INDEX IF NOT EXISTS "addresses_identity_idx" ON "addresses" USING btree ("identity_id");

CREATE INDEX IF NOT EXISTS "addresses_postal_code_idx" ON "addresses" USING btree ("postal_code");

CREATE INDEX IF NOT EXISTS "addresses_place_id_idx" ON "addresses" USING btree ("place_id");

CREATE INDEX IF NOT EXISTS "addresses_city_id_idx" ON "addresses" USING btree ("city_id");

CREATE INDEX IF NOT EXISTS "addresses_is_default_idx" ON "addresses" USING btree ("is_default");

CREATE INDEX IF NOT EXISTS "addresses_verification_idx" ON "addresses" USING btree ("verification_status");

CREATE INDEX IF NOT EXISTS "addresses_normalized_idx" ON "addresses" USING btree ("normalized_address");

CREATE UNIQUE INDEX IF NOT EXISTS "customer_location_links_customer_location_unique" ON "customer_location_links" USING btree ("customer_id","service_location_id");

CREATE UNIQUE INDEX IF NOT EXISTS "dcms_missed_visit_logs_sub_date_unique" ON "dcms_missed_visit_logs" USING btree ("subscription_id","visit_date");

CREATE INDEX IF NOT EXISTS "idx_dcms_missed_logs_date" ON "dcms_missed_visit_logs" USING btree ("visit_date");

CREATE INDEX IF NOT EXISTS "idx_dcms_exceptions_sub" ON "dcms_operational_exceptions" USING btree ("subscription_id");

CREATE INDEX IF NOT EXISTS "idx_dcms_exceptions_society" ON "dcms_operational_exceptions" USING btree ("society_id");

CREATE INDEX IF NOT EXISTS "idx_dcms_exceptions_status" ON "dcms_operational_exceptions" USING btree ("status");

CREATE INDEX IF NOT EXISTS "idx_dcms_exceptions_complaint" ON "dcms_operational_exceptions" USING btree ("complaint_id");

CREATE INDEX IF NOT EXISTS "idx_dcms_pause_history_sub" ON "dcms_pause_history" USING btree ("subscription_id");

CREATE INDEX IF NOT EXISTS "idx_dcms_subscriptions_status" ON "dcms_subscriptions" USING btree ("status");

CREATE INDEX IF NOT EXISTS "idx_dcms_subscriptions_customer" ON "dcms_subscriptions" USING btree ("customer_id");

CREATE UNIQUE INDEX IF NOT EXISTS "dcms_visit_feedback_visit_unique" ON "dcms_visit_feedback" USING btree ("visit_id");

CREATE INDEX IF NOT EXISTS "idx_dcms_visit_feedback_customer" ON "dcms_visit_feedback" USING btree ("customer_id");

CREATE INDEX IF NOT EXISTS "idx_dcms_visit_feedback_sub" ON "dcms_visit_feedback" USING btree ("subscription_id");

CREATE INDEX IF NOT EXISTS "idx_dcms_visit_feedback_staff" ON "dcms_visit_feedback" USING btree ("staff_id");

CREATE INDEX IF NOT EXISTS "idx_dcms_visit_feedback_score" ON "dcms_visit_feedback" USING btree ("rating_score");

CREATE INDEX IF NOT EXISTS "idx_dcms_visits_sub_date" ON "dcms_visits" USING btree ("subscription_id","visit_date");

CREATE INDEX IF NOT EXISTS "idx_dcms_visits_staff_status" ON "dcms_visits" USING btree ("staff_id","status");

CREATE INDEX IF NOT EXISTS "idx_notification_events_type" ON "notification_events" USING btree ("event_type");

CREATE INDEX IF NOT EXISTS "extra_svc_req_customer_status_idx" ON "extra_service_requests" USING btree ("customer_id","status");

CREATE INDEX IF NOT EXISTS "extra_svc_req_staff_status_idx" ON "extra_service_requests" USING btree ("staff_id","status");

CREATE INDEX IF NOT EXISTS "extra_svc_req_execution_idx" ON "extra_service_requests" USING btree ("execution_id");

CREATE UNIQUE INDEX IF NOT EXISTS "extra_svc_req_booking_unique" ON "extra_service_requests" USING btree ("booking_id");

CREATE INDEX IF NOT EXISTS "idx_push_notifications_user" ON "push_notifications" USING btree ("user_id","created_at");

CREATE INDEX IF NOT EXISTS "idx_push_notifications_event" ON "push_notifications" USING btree ("notification_event_id");

CREATE INDEX IF NOT EXISTS "idx_push_notifications_event_type" ON "push_notifications" USING btree ("event_type");

CREATE INDEX IF NOT EXISTS "idx_push_subscriptions_user" ON "push_subscriptions" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "idx_push_subscriptions_role" ON "push_subscriptions" USING btree ("role");

CREATE INDEX IF NOT EXISTS "idx_societies_city" ON "residential_societies" USING btree ("city_id");

CREATE INDEX IF NOT EXISTS "idx_societies_service_area" ON "residential_societies" USING btree ("service_area_id");

CREATE INDEX IF NOT EXISTS "idx_societies_code" ON "residential_societies" USING btree ("code");

CREATE INDEX IF NOT EXISTS "idx_society_towers_society" ON "society_towers" USING btree ("society_id");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_invoice_seq_entity_type_fy" ON "invoice_number_sequences" USING btree ("legal_entity_id","document_type","financial_year");

CREATE INDEX IF NOT EXISTS "idx_legal_entities_code" ON "legal_entities" USING btree ("code");

CREATE INDEX IF NOT EXISTS "idx_legal_entities_state" ON "legal_entities" USING btree ("state_code");

CREATE INDEX IF NOT EXISTS "idx_promotions_city" ON "promotions" USING btree ("city_id");

CREATE INDEX IF NOT EXISTS "idx_promotions_branch" ON "promotions" USING btree ("branch_id");

CREATE INDEX IF NOT EXISTS "idx_promotions_placement" ON "promotions" USING btree ("placement");

CREATE INDEX IF NOT EXISTS "idx_promotions_active" ON "promotions" USING btree ("is_active");

CREATE INDEX IF NOT EXISTS "idx_promotions_status" ON "promotions" USING btree ("status");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_city_landing_city_branch_slug" ON "city_landing_pages" USING btree ("city_id","branch_id","slug");

CREATE INDEX IF NOT EXISTS "idx_city_landing_slug" ON "city_landing_pages" USING btree ("slug");

CREATE INDEX IF NOT EXISTS "idx_city_landing_published" ON "city_landing_pages" USING btree ("is_published");

CREATE INDEX IF NOT EXISTS "idx_homepage_sections_city" ON "homepage_sections" USING btree ("city_id");

CREATE INDEX IF NOT EXISTS "idx_homepage_sections_branch" ON "homepage_sections" USING btree ("branch_id");

CREATE INDEX IF NOT EXISTS "idx_homepage_sections_key" ON "homepage_sections" USING btree ("section_key");

CREATE INDEX IF NOT EXISTS "idx_homepage_sections_sort" ON "homepage_sections" USING btree ("sort_order");

CREATE INDEX IF NOT EXISTS "idx_homepage_sections_enabled" ON "homepage_sections" USING btree ("is_enabled");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_marketing_campaigns_code" ON "marketing_campaigns" USING btree ("code");

CREATE INDEX IF NOT EXISTS "idx_marketing_campaigns_city" ON "marketing_campaigns" USING btree ("city_id");

CREATE INDEX IF NOT EXISTS "idx_marketing_campaigns_branch" ON "marketing_campaigns" USING btree ("branch_id");

CREATE INDEX IF NOT EXISTS "idx_marketing_campaigns_status" ON "marketing_campaigns" USING btree ("status");

CREATE INDEX IF NOT EXISTS "idx_marketing_campaigns_active" ON "marketing_campaigns" USING btree ("is_active");

CREATE INDEX IF NOT EXISTS "idx_mkt_events_type_time" ON "marketing_events" USING btree ("event_type","recorded_at");

CREATE INDEX IF NOT EXISTS "idx_mkt_events_city_type" ON "marketing_events" USING btree ("city_id","event_type");

CREATE INDEX IF NOT EXISTS "idx_mkt_events_campaign" ON "marketing_events" USING btree ("campaign_id");

CREATE INDEX IF NOT EXISTS "idx_mkt_events_banner" ON "marketing_events" USING btree ("banner_id");

CREATE INDEX IF NOT EXISTS "idx_media_assets_city" ON "marketing_media_assets" USING btree ("city_id");

CREATE INDEX IF NOT EXISTS "idx_media_assets_branch" ON "marketing_media_assets" USING btree ("branch_id");

CREATE INDEX IF NOT EXISTS "idx_media_assets_active" ON "marketing_media_assets" USING btree ("is_active");

CREATE INDEX IF NOT EXISTS "idx_admin_audit_entity" ON "admin_audit_logs" USING btree ("entity_type","entity_id");

CREATE INDEX IF NOT EXISTS "idx_admin_audit_action" ON "admin_audit_logs" USING btree ("action");

CREATE INDEX IF NOT EXISTS "idx_admin_audit_branch" ON "admin_audit_logs" USING btree ("branch_id");

CREATE INDEX IF NOT EXISTS "idx_admin_audit_created" ON "admin_audit_logs" USING btree ("created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "staff_payout_ledgers_staff_month_unique" ON "staff_payout_ledgers" USING btree ("staff_id","period_month");

CREATE INDEX IF NOT EXISTS "idx_staff_payout_ledgers_period_month" ON "staff_payout_ledgers" USING btree ("period_month");

CREATE INDEX IF NOT EXISTS "idx_staff_payout_ledgers_branch" ON "staff_payout_ledgers" USING btree ("branch_id");

CREATE INDEX IF NOT EXISTS "idx_staff_payout_ledgers_city" ON "staff_payout_ledgers" USING btree ("city_id");

CREATE INDEX IF NOT EXISTS "idx_staff_payout_ledgers_status" ON "staff_payout_ledgers" USING btree ("status");

CREATE INDEX IF NOT EXISTS "idx_exp_exposures_exp_var" ON "ux_experiment_exposures" USING btree ("experiment_id","variant_id");

CREATE INDEX IF NOT EXISTS "idx_exp_exposures_converted" ON "ux_experiment_exposures" USING btree ("experiment_id","converted");

CREATE INDEX IF NOT EXISTS "idx_exp_exposures_session" ON "ux_experiment_exposures" USING btree ("session_id");

CREATE INDEX IF NOT EXISTS "idx_ux_experiments_key" ON "ux_experiments" USING btree ("key");

CREATE INDEX IF NOT EXISTS "idx_ux_experiments_status" ON "ux_experiments" USING btree ("status");

CREATE INDEX IF NOT EXISTS "idx_ux_experiments_target" ON "ux_experiments" USING btree ("target_screen");

CREATE INDEX IF NOT EXISTS "idx_ux_experiments_city" ON "ux_experiments" USING btree ("city_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_service_exceptions_code" ON "service_exceptions" USING btree ("exception_code");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_service_exceptions_dedupe" ON "service_exceptions" USING btree ("dedupe_key");

CREATE INDEX IF NOT EXISTS "idx_service_exceptions_status" ON "service_exceptions" USING btree ("status");

CREATE INDEX IF NOT EXISTS "idx_service_exceptions_category" ON "service_exceptions" USING btree ("category");

CREATE INDEX IF NOT EXISTS "idx_service_exceptions_city_branch" ON "service_exceptions" USING btree ("city_id","branch_id");

CREATE INDEX IF NOT EXISTS "idx_service_exceptions_booking" ON "service_exceptions" USING btree ("booking_id");

CREATE INDEX IF NOT EXISTS "idx_service_exceptions_customer" ON "service_exceptions" USING btree ("customer_id");

CREATE INDEX IF NOT EXISTS "idx_service_exceptions_staff" ON "service_exceptions" USING btree ("staff_id");

CREATE INDEX IF NOT EXISTS "idx_service_exceptions_created" ON "service_exceptions" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "payment_refunds_refund_id_idx" ON "payment_refunds" USING btree ("refund_id");

CREATE INDEX IF NOT EXISTS "payment_refunds_payment_id_idx" ON "payment_refunds" USING btree ("payment_id");

CREATE INDEX IF NOT EXISTS "payment_refunds_attempt_id_idx" ON "payment_refunds" USING btree ("attempt_id");

CREATE INDEX IF NOT EXISTS "payment_refunds_customer_id_idx" ON "payment_refunds" USING btree ("customer_id");

CREATE INDEX IF NOT EXISTS "payment_refunds_booking_id_idx" ON "payment_refunds" USING btree ("booking_id");

CREATE INDEX IF NOT EXISTS "payment_refunds_invoice_id_idx" ON "payment_refunds" USING btree ("invoice_id");

CREATE INDEX IF NOT EXISTS "payment_refunds_status_idx" ON "payment_refunds" USING btree ("status");

CREATE INDEX IF NOT EXISTS "payment_refunds_created_at_idx" ON "payment_refunds" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "payment_refunds_gateway_provider_idx" ON "payment_refunds" USING btree ("gateway_provider");

CREATE UNIQUE INDEX IF NOT EXISTS "payment_webhook_events_event_id_idx" ON "payment_webhook_events" USING btree ("event_id");

CREATE INDEX IF NOT EXISTS "payment_webhook_events_order_id_idx" ON "payment_webhook_events" USING btree ("order_id");

CREATE INDEX IF NOT EXISTS "payment_webhook_events_payment_id_idx" ON "payment_webhook_events" USING btree ("payment_id");

CREATE INDEX IF NOT EXISTS "payment_webhook_events_created_at_idx" ON "payment_webhook_events" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "idx_operating_hours_lookup" ON "operating_hours" USING btree ("scope_type","city_id","branch_id","day_of_week");

CREATE INDEX IF NOT EXISTS "idx_operational_closures_dates" ON "operational_closures" USING btree ("start_date","end_date","is_active");

CREATE INDEX IF NOT EXISTS "idx_operational_closures_scope" ON "operational_closures" USING btree ("scope_type","city_id","branch_id");

CREATE INDEX IF NOT EXISTS "idx_geographic_localities_city" ON "geographic_localities" USING btree ("city_id");

CREATE INDEX IF NOT EXISTS "idx_geographic_localities_slug" ON "geographic_localities" USING btree ("slug");

CREATE INDEX IF NOT EXISTS "idx_geographic_localities_pincode" ON "geographic_localities" USING btree ("pincode");

CREATE INDEX IF NOT EXISTS "idx_location_aliases_lookup" ON "location_aliases" USING btree ("entity_type","normalized_alias");

CREATE INDEX IF NOT EXISTS "idx_location_aliases_entity" ON "location_aliases" USING btree ("entity_type","entity_id");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_branch_zone_mapping" ON "branch_zone_mappings" USING btree ("branch_id","zone_id");

CREATE INDEX IF NOT EXISTS "idx_branch_zone_branch" ON "branch_zone_mappings" USING btree ("branch_id","is_active");

CREATE INDEX IF NOT EXISTS "idx_branch_zone_zone" ON "branch_zone_mappings" USING btree ("zone_id","is_active");

CREATE INDEX IF NOT EXISTS "idx_operational_zones_city" ON "operational_zones" USING btree ("city_id");

CREATE INDEX IF NOT EXISTS "idx_operational_zones_branch" ON "operational_zones" USING btree ("branch_id");

CREATE INDEX IF NOT EXISTS "idx_operational_zones_status" ON "operational_zones" USING btree ("status","is_active");

CREATE INDEX IF NOT EXISTS "idx_zone_coverage_zone" ON "zone_coverage_rules" USING btree ("zone_id","is_active");

CREATE INDEX IF NOT EXISTS "idx_zone_coverage_society" ON "zone_coverage_rules" USING btree ("society_id","is_active");

CREATE INDEX IF NOT EXISTS "idx_zone_coverage_locality" ON "zone_coverage_rules" USING btree ("locality_id","is_active");

CREATE INDEX IF NOT EXISTS "idx_zone_coverage_pincode" ON "zone_coverage_rules" USING btree ("pincode","is_active");

CREATE INDEX IF NOT EXISTS "idx_loc_pricing_lookup" ON "location_pricing_rules" USING btree ("city_id","service_id","location_type","is_active");

CREATE INDEX IF NOT EXISTS "idx_loc_pricing_branch" ON "location_pricing_rules" USING btree ("branch_id","is_active");

CREATE INDEX IF NOT EXISTS "idx_loc_pricing_zone" ON "location_pricing_rules" USING btree ("zone_id","is_active");

CREATE INDEX IF NOT EXISTS "idx_loc_pricing_society" ON "location_pricing_rules" USING btree ("society_id","is_active");

CREATE INDEX IF NOT EXISTS "idx_pricing_audit_rule" ON "pricing_rule_audit_logs" USING btree ("rule_id");
