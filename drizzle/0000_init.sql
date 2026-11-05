CREATE TABLE `admin_password_resets` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_password_resets_token_hash_unique` ON `admin_password_resets` (`token_hash`);--> statement-breakpoint
CREATE INDEX `admin_password_resets_admin_id_idx` ON `admin_password_resets` (`admin_id`);--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`csrf_secret` text NOT NULL,
	`ip_hash` text,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_sessions_token_hash_unique` ON `admin_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `admin_sessions_admin_id_idx` ON `admin_sessions` (`admin_id`);--> statement-breakpoint
CREATE INDEX `admin_sessions_expires_at_idx` ON `admin_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `admins` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`full_name` text NOT NULL,
	`role` text DEFAULT 'admin' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`must_change_password` integer DEFAULT true NOT NULL,
	`password_changed_at` integer,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_email_unique` ON `admins` (`email`);--> statement-breakpoint
CREATE INDEX `admins_is_active_idx` ON `admins` (`is_active`);--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`storage_key` text NOT NULL,
	`storage_provider` text DEFAULT 'blobs' NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`purpose` text DEFAULT 'other' NOT NULL,
	`original_filename` text NOT NULL,
	`stored_filename` text NOT NULL,
	`declared_mime_type` text,
	`detected_mime_type` text NOT NULL,
	`extension` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`width` integer,
	`height` integer,
	`checksum_sha256` text NOT NULL,
	`alt_text` text,
	`caption` text,
	`uploaded_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`uploaded_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_assets_storage_key_unique` ON `media_assets` (`storage_key`);--> statement-breakpoint
CREATE INDEX `media_assets_visibility_purpose_idx` ON `media_assets` (`visibility`,`purpose`);--> statement-breakpoint
CREATE INDEX `media_assets_created_at_idx` ON `media_assets` (`created_at`);--> statement-breakpoint
CREATE INDEX `media_assets_checksum_idx` ON `media_assets` (`checksum_sha256`);--> statement-breakpoint
CREATE TABLE `faqs` (
	`id` text PRIMARY KEY NOT NULL,
	`question` text NOT NULL,
	`answer_md` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'General' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`updated_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`updated_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `faqs_status_order_idx` ON `faqs` (`status`,`display_order`);--> statement-breakpoint
CREATE TABLE `homepage_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`section_key` text NOT NULL,
	`heading` text DEFAULT '' NOT NULL,
	`subheading` text DEFAULT '' NOT NULL,
	`body_md` text DEFAULT '' NOT NULL,
	`cta_label` text DEFAULT '' NOT NULL,
	`cta_href` text DEFAULT '' NOT NULL,
	`secondary_cta_label` text DEFAULT '' NOT NULL,
	`secondary_cta_href` text DEFAULT '' NOT NULL,
	`image_asset_id` text,
	`is_visible` integer DEFAULT true NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`updated_by` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`image_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `homepage_sections_key_unique` ON `homepage_sections` (`section_key`);--> statement-breakpoint
CREATE INDEX `homepage_sections_order_idx` ON `homepage_sections` (`display_order`);--> statement-breakpoint
CREATE TABLE `seo_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`route` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`og_title` text DEFAULT '' NOT NULL,
	`og_description` text DEFAULT '' NOT NULL,
	`og_image_asset_id` text,
	`canonical_override` text DEFAULT '' NOT NULL,
	`no_index` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`og_image_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seo_settings_route_unique` ON `seo_settings` (`route`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`agency_name` text DEFAULT '' NOT NULL,
	`tagline` text DEFAULT '' NOT NULL,
	`short_description` text DEFAULT '' NOT NULL,
	`long_description` text DEFAULT '' NOT NULL,
	`logo_asset_id` text,
	`logo_dark_asset_id` text,
	`favicon_asset_id` text,
	`og_image_asset_id` text,
	`brand_primary_color` text DEFAULT '#E11D2E' NOT NULL,
	`brand_secondary_color` text DEFAULT '#1D4ED8' NOT NULL,
	`brand_active_color` text DEFAULT '#1E3FBF' NOT NULL,
	`brand_text_color` text DEFAULT '#111827' NOT NULL,
	`contact_email` text DEFAULT '' NOT NULL,
	`contact_phone_primary` text DEFAULT '' NOT NULL,
	`contact_phone_secondary` text DEFAULT '' NOT NULL,
	`contact_whatsapp` text DEFAULT '' NOT NULL,
	`address_line1` text DEFAULT '' NOT NULL,
	`address_line2` text DEFAULT '' NOT NULL,
	`address_city` text DEFAULT '' NOT NULL,
	`address_state` text DEFAULT '' NOT NULL,
	`address_postal_code` text DEFAULT '' NOT NULL,
	`address_country` text DEFAULT '' NOT NULL,
	`office_hours` text DEFAULT '' NOT NULL,
	`map_embed_url` text DEFAULT '' NOT NULL,
	`social_facebook` text DEFAULT '' NOT NULL,
	`social_instagram` text DEFAULT '' NOT NULL,
	`social_linkedin` text DEFAULT '' NOT NULL,
	`social_x` text DEFAULT '' NOT NULL,
	`social_tiktok` text DEFAULT '' NOT NULL,
	`social_youtube` text DEFAULT '' NOT NULL,
	`privacy_retention_days` integer DEFAULT 0 NOT NULL,
	`privacy_contact_email` text DEFAULT '' NOT NULL,
	`allow_search_indexing` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`logo_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`logo_dark_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`favicon_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`og_image_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `site_settings_updated_at_idx` ON `site_settings` (`updated_at`);--> statement-breakpoint
CREATE TABLE `website_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`content_md` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`last_reviewed_on` text,
	`updated_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `website_pages_slug_unique` ON `website_pages` (`slug`);--> statement-breakpoint
CREATE INDEX `website_pages_status_idx` ON `website_pages` (`status`);--> statement-breakpoint
CREATE TABLE `service_features` (
	`id` text PRIMARY KEY NOT NULL,
	`service_id` text NOT NULL,
	`label` text NOT NULL,
	`detail_md` text DEFAULT '' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `service_features_service_idx` ON `service_features` (`service_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`short_description` text DEFAULT '' NOT NULL,
	`description_md` text DEFAULT '' NOT NULL,
	`icon_name` text DEFAULT 'Briefcase' NOT NULL,
	`image_asset_id` text,
	`cta_label` text DEFAULT '' NOT NULL,
	`cta_href` text DEFAULT '' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`updated_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`image_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `services_slug_unique` ON `services` (`slug`);--> statement-breakpoint
CREATE INDEX `services_status_order_idx` ON `services` (`status`,`display_order`);--> statement-breakpoint
CREATE TABLE `countries` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`iso_code` text NOT NULL,
	`slug` text NOT NULL,
	`flag_emoji` text DEFAULT '' NOT NULL,
	`flag_asset_id` text,
	`hero_image_asset_id` text,
	`summary` text DEFAULT '' NOT NULL,
	`description_md` text DEFAULT '' NOT NULL,
	`is_featured` integer DEFAULT false NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`updated_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`flag_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`hero_image_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `countries_iso_code_unique` ON `countries` (`iso_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `countries_slug_unique` ON `countries` (`slug`);--> statement-breakpoint
CREATE INDEX `countries_status_order_idx` ON `countries` (`status`,`display_order`);--> statement-breakpoint
CREATE TABLE `destination_requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`destination_id` text NOT NULL,
	`category` text NOT NULL,
	`label` text NOT NULL,
	`detail_md` text DEFAULT '' NOT NULL,
	`link_url` text DEFAULT '' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `destination_requirements_destination_idx` ON `destination_requirements` (`destination_id`,`category`,`display_order`);--> statement-breakpoint
CREATE TABLE `destinations` (
	`id` text PRIMARY KEY NOT NULL,
	`country_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`description_md` text DEFAULT '' NOT NULL,
	`processing_info_md` text DEFAULT '' NOT NULL,
	`important_notice_md` text DEFAULT '' NOT NULL,
	`hero_image_asset_id` text,
	`is_featured` integer DEFAULT false NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`updated_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`hero_image_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `destinations_slug_unique` ON `destinations` (`slug`);--> statement-breakpoint
CREATE INDEX `destinations_country_idx` ON `destinations` (`country_id`);--> statement-breakpoint
CREATE INDEX `destinations_status_order_idx` ON `destinations` (`status`,`display_order`);--> statement-breakpoint
CREATE TABLE `employment_opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`country_id` text NOT NULL,
	`destination_id` text,
	`title` text NOT NULL,
	`sector` text DEFAULT '' NOT NULL,
	`description_md` text DEFAULT '' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `employment_opportunities_country_idx` ON `employment_opportunities` (`country_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `employment_opportunities_destination_idx` ON `employment_opportunities` (`destination_id`);--> statement-breakpoint
CREATE TABLE `visa_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`destination_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text DEFAULT '' NOT NULL,
	`description_md` text DEFAULT '' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `visa_categories_destination_idx` ON `visa_categories` (`destination_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`full_name` text NOT NULL,
	`professional_title` text DEFAULT '' NOT NULL,
	`department` text DEFAULT '' NOT NULL,
	`bio_md` text DEFAULT '' NOT NULL,
	`qualifications` text DEFAULT '' NOT NULL,
	`areas_of_expertise` text DEFAULT '' NOT NULL,
	`photo_asset_id` text,
	`email_public` text DEFAULT '' NOT NULL,
	`social_linkedin` text DEFAULT '' NOT NULL,
	`social_x` text DEFAULT '' NOT NULL,
	`social_facebook` text DEFAULT '' NOT NULL,
	`social_instagram` text DEFAULT '' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`updated_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`photo_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_slug_unique` ON `team_members` (`slug`);--> statement-breakpoint
CREATE INDEX `team_members_status_order_idx` ON `team_members` (`status`,`display_order`);--> statement-breakpoint
CREATE TABLE `testimonials` (
	`id` text PRIMARY KEY NOT NULL,
	`client_display_name` text NOT NULL,
	`client_country` text DEFAULT '' NOT NULL,
	`service_category` text DEFAULT '' NOT NULL,
	`quote` text NOT NULL,
	`photo_asset_id` text,
	`video_asset_id` text,
	`video_url` text DEFAULT '' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`updated_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`photo_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`video_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "testimonials_single_video_source" CHECK(NOT ("testimonials"."video_asset_id" IS NOT NULL AND length("testimonials"."video_url") > 0))
);
--> statement-breakpoint
CREATE INDEX `testimonials_status_order_idx` ON `testimonials` (`status`,`display_order`);--> statement-breakpoint
CREATE TABLE `applicant_education` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`qualification_level` text NOT NULL,
	`institution_name` text NOT NULL,
	`country` text NOT NULL,
	`year_completed` integer NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `applicant_education_assessment_idx` ON `applicant_education` (`assessment_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `applicant_employment` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`record_type` text NOT NULL,
	`employer_name` text NOT NULL,
	`position` text NOT NULL,
	`country` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`years_worked` integer,
	`monthly_salary_amount` integer,
	`monthly_salary_currency` text DEFAULT '' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `applicant_employment_assessment_idx` ON `applicant_employment` (`assessment_id`,`record_type`,`display_order`);--> statement-breakpoint
CREATE TABLE `applicant_examinations` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`examination_name` text NOT NULL,
	`result_notes` text DEFAULT '' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `applicant_examinations_assessment_idx` ON `applicant_examinations` (`assessment_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `applicant_family_abroad` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`country` text NOT NULL,
	`relationship` text DEFAULT '' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `applicant_family_abroad_assessment_idx` ON `applicant_family_abroad` (`assessment_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `applicant_languages` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`language` text NOT NULL,
	`proficiency` text NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applicant_languages_unique` ON `applicant_languages` (`assessment_id`,`language`);--> statement-breakpoint
CREATE TABLE `applicant_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`skill` text NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applicant_skills_unique` ON `applicant_skills` (`assessment_id`,`skill`);--> statement-breakpoint
CREATE TABLE `applicant_travel_history` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`country` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `applicant_travel_history_assessment_idx` ON `applicant_travel_history` (`assessment_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `assessment_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`media_asset_id` text NOT NULL,
	`kind` text DEFAULT 'cv' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`media_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `assessment_attachments_assessment_idx` ON `assessment_attachments` (`assessment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `assessment_attachments_media_unique` ON `assessment_attachments` (`media_asset_id`);--> statement-breakpoint
CREATE TABLE `assessment_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`admin_id` text,
	`body` text NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `assessment_notes_assessment_idx` ON `assessment_notes` (`assessment_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `assessment_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`admin_id` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `assessment_status_history_assessment_idx` ON `assessment_status_history` (`assessment_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`reference_number` text NOT NULL,
	`idempotency_key` text,
	`full_name` text NOT NULL,
	`date_of_birth` text NOT NULL,
	`gender` text NOT NULL,
	`nationality` text NOT NULL,
	`country_of_residence` text NOT NULL,
	`residential_address` text NOT NULL,
	`city` text NOT NULL,
	`state_province` text NOT NULL,
	`postal_code` text NOT NULL,
	`mobile_country_code` text NOT NULL,
	`mobile_number` text NOT NULL,
	`alt_mobile_country_code` text DEFAULT '' NOT NULL,
	`alt_mobile_number` text DEFAULT '' NOT NULL,
	`email` text NOT NULL,
	`marital_status` text NOT NULL,
	`has_children` integer NOT NULL,
	`number_of_children` integer,
	`has_passport` integer NOT NULL,
	`passport_number` text,
	`passport_city_of_issue` text,
	`passport_issue_date` text,
	`passport_expiry_date` text,
	`preferred_country_id` text,
	`preferred_country_text` text DEFAULT '' NOT NULL,
	`preferred_occupation` text NOT NULL,
	`expected_salary_amount` integer,
	`expected_salary_currency` text DEFAULT '' NOT NULL,
	`has_medical_condition` integer NOT NULL,
	`medical_details` text,
	`has_criminal_record` integer NOT NULL,
	`criminal_record_details` text,
	`has_travelled_abroad` integer NOT NULL,
	`travelled_countries` text,
	`has_family_abroad` integer NOT NULL,
	`family_abroad_countries` text,
	`has_professional_exams` integer NOT NULL,
	`professional_exams_notes` text,
	`status` text DEFAULT 'new' NOT NULL,
	`submitted_at` integer NOT NULL,
	`reviewed_at` integer,
	`reviewed_by` text,
	`submission_ip_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`preferred_country_id`) REFERENCES `countries`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reviewed_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "assessments_children_consistency" CHECK(("assessments"."has_children" = 1 AND "assessments"."number_of_children" IS NOT NULL)
          OR ("assessments"."has_children" = 0 AND "assessments"."number_of_children" IS NULL)),
	CONSTRAINT "assessments_passport_consistency" CHECK(("assessments"."has_passport" = 1 AND "assessments"."passport_number" IS NOT NULL)
          OR ("assessments"."has_passport" = 0 AND "assessments"."passport_number" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assessments_reference_unique` ON `assessments` (`reference_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `assessments_idempotency_unique` ON `assessments` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `assessments_email_idx` ON `assessments` (`email`);--> statement-breakpoint
CREATE INDEX `assessments_submitted_at_idx` ON `assessments` (`submitted_at`);--> statement-breakpoint
CREATE INDEX `assessments_status_idx` ON `assessments` (`status`);--> statement-breakpoint
CREATE INDEX `assessments_preferred_country_idx` ON `assessments` (`preferred_country_id`);--> statement-breakpoint
CREATE INDEX `assessments_full_name_idx` ON `assessments` (`full_name`);--> statement-breakpoint
CREATE TABLE `consent_records` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text,
	`terms_page_id` text NOT NULL,
	`terms_version` integer NOT NULL,
	`privacy_page_id` text NOT NULL,
	`privacy_version` integer NOT NULL,
	`consent_text` text NOT NULL,
	`accepted_at` integer NOT NULL,
	`ip_hash` text,
	`user_agent` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `consent_records_assessment_unique` ON `consent_records` (`assessment_id`);--> statement-breakpoint
CREATE INDEX `consent_records_accepted_at_idx` ON `consent_records` (`accepted_at`);--> statement-breakpoint
CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_admin_id` text,
	`actor_email_snapshot` text,
	`action` text NOT NULL,
	`entity_type` text DEFAULT '' NOT NULL,
	`entity_id` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`metadata` text,
	`ip_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`actor_admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `activity_logs_created_at_idx` ON `activity_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `activity_logs_entity_idx` ON `activity_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `activity_logs_actor_idx` ON `activity_logs` (`actor_admin_id`);--> statement-breakpoint
CREATE INDEX `activity_logs_action_idx` ON `activity_logs` (`action`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`email_hash` text NOT NULL,
	`ip_hash` text NOT NULL,
	`success` integer NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_attempts_ip_created_idx` ON `login_attempts` (`ip_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `login_attempts_email_created_idx` ON `login_attempts` (`email_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `rate_limit_buckets` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window_start` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limit_buckets_expires_idx` ON `rate_limit_buckets` (`expires_at`);