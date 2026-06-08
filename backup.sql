--
-- PostgreSQL database dump
--

\restrict lH1HO0Y4j7ongQ8aKh2irv02JDkeokoGU4TxuGLdnRcuUj9lrSS89uWXxjuK8gr

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: attendance_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.attendance_status AS ENUM (
    'present',
    'absent',
    'late',
    'half_day'
);


ALTER TYPE public.attendance_status OWNER TO postgres;

--
-- Name: booking_service_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.booking_service_type AS ENUM (
    'car_wash',
    'detailing',
    'solar_cleaning',
    'pickup_drop',
    'emergency'
);


ALTER TYPE public.booking_service_type OWNER TO postgres;

--
-- Name: booking_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.booking_status AS ENUM (
    'pending',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE public.booking_status OWNER TO postgres;

--
-- Name: complaint_priority; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.complaint_priority AS ENUM (
    'low',
    'medium',
    'high'
);


ALTER TYPE public.complaint_priority OWNER TO postgres;

--
-- Name: complaint_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.complaint_status AS ENUM (
    'open',
    'in_progress',
    'resolved',
    'closed'
);


ALTER TYPE public.complaint_status OWNER TO postgres;

--
-- Name: complaint_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.complaint_type AS ENUM (
    'quality',
    'delay',
    'reclean',
    'damage',
    'billing',
    'other'
);


ALTER TYPE public.complaint_type OWNER TO postgres;

--
-- Name: customer_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.customer_status AS ENUM (
    'active',
    'inactive',
    'suspended'
);


ALTER TYPE public.customer_status OWNER TO postgres;

--
-- Name: franchisee_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.franchisee_status AS ENUM (
    'active',
    'inactive',
    'terminated',
    'pending'
);


ALTER TYPE public.franchisee_status OWNER TO postgres;

--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.invoice_status AS ENUM (
    'draft',
    'sent',
    'paid',
    'overdue',
    'cancelled'
);


ALTER TYPE public.invoice_status OWNER TO postgres;

--
-- Name: notification_channel; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.notification_channel AS ENUM (
    'in_app',
    'whatsapp',
    'email',
    'sms'
);


ALTER TYPE public.notification_channel OWNER TO postgres;

--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.notification_type AS ENUM (
    'booking_confirmation',
    'payment_reminder',
    'subscription_expiry',
    'service_complete',
    'complaint_update',
    'broadcast'
);


ALTER TYPE public.notification_type OWNER TO postgres;

--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.payment_method AS ENUM (
    'cash',
    'upi',
    'card',
    'bank_transfer',
    'wallet',
    'razorpay'
);


ALTER TYPE public.payment_method OWNER TO postgres;

--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'refunded'
);


ALTER TYPE public.payment_status OWNER TO postgres;

--
-- Name: service_category; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.service_category AS ENUM (
    'car_wash',
    'detailing',
    'ceramic_coating',
    'ppf',
    'interior',
    'solar_cleaning',
    'amc',
    'subscription'
);


ALTER TYPE public.service_category OWNER TO postgres;

--
-- Name: staff_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.staff_role AS ENUM (
    'technician',
    'supervisor',
    'driver',
    'solar_technician'
);


ALTER TYPE public.staff_role OWNER TO postgres;

--
-- Name: staff_verification_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.staff_verification_status AS ENUM (
    'pending',
    'verified',
    'rejected'
);


ALTER TYPE public.staff_verification_status OWNER TO postgres;

--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.subscription_status AS ENUM (
    'active',
    'expired',
    'cancelled',
    'pending'
);


ALTER TYPE public.subscription_status OWNER TO postgres;

--
-- Name: subscription_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.subscription_type AS ENUM (
    'daily_wash',
    'monthly_wash',
    'solar_amc',
    'detailing_plan'
);


ALTER TYPE public.subscription_type OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'customer',
    'staff',
    'admin',
    'superadmin',
    'franchisee'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: vehicle_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.vehicle_type AS ENUM (
    'sedan',
    'suv',
    'hatchback',
    'luxury',
    'van',
    'truck'
);


ALTER TYPE public.vehicle_type OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attendance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance (
    id integer NOT NULL,
    staff_id integer NOT NULL,
    date date NOT NULL,
    status public.attendance_status NOT NULL,
    check_in_time text,
    check_out_time text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.attendance OWNER TO postgres;

--
-- Name: attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.attendance_id_seq OWNER TO postgres;

--
-- Name: attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.attendance_id_seq OWNED BY public.attendance.id;


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bookings (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    vehicle_id integer,
    solar_site_id integer,
    subscription_id integer,
    service_id integer,
    staff_id integer,
    branch_id integer,
    scheduled_date date NOT NULL,
    scheduled_time text,
    status public.booking_status DEFAULT 'pending'::public.booking_status NOT NULL,
    service_type public.booking_service_type NOT NULL,
    address text,
    notes text,
    completed_at timestamp without time zone,
    before_photo_url text,
    after_photo_url text,
    technician_notes text,
    rating integer,
    amount numeric(10,2),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bookings OWNER TO postgres;

--
-- Name: bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bookings_id_seq OWNER TO postgres;

--
-- Name: bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bookings_id_seq OWNED BY public.bookings.id;


--
-- Name: branches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.branches (
    id integer NOT NULL,
    name text NOT NULL,
    city text NOT NULL,
    address text,
    phone text,
    manager_name text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.branches OWNER TO postgres;

--
-- Name: branches_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.branches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.branches_id_seq OWNER TO postgres;

--
-- Name: branches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.branches_id_seq OWNED BY public.branches.id;


--
-- Name: complaints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.complaints (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    booking_id integer,
    type public.complaint_type NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    status public.complaint_status DEFAULT 'open'::public.complaint_status NOT NULL,
    priority public.complaint_priority DEFAULT 'medium'::public.complaint_priority NOT NULL,
    resolution text,
    resolved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.complaints OWNER TO postgres;

--
-- Name: complaints_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.complaints_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.complaints_id_seq OWNER TO postgres;

--
-- Name: complaints_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.complaints_id_seq OWNED BY public.complaints.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    user_id integer,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    address text,
    city text,
    status public.customer_status DEFAULT 'active'::public.customer_status NOT NULL,
    wallet_balance numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    total_dues numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    branch_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customers_id_seq OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: franchisees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.franchisees (
    id integer NOT NULL,
    user_id integer,
    branch_id integer,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    secondary_phone text,
    current_address text,
    permanent_address text,
    aadhaar text,
    pan text,
    rent_agreement_url text,
    franchisee_agreement_url text,
    tenure_start_date date,
    tenure_end_date date,
    final_amount_agreed numeric(12,2),
    amount_deposited numeric(12,2) DEFAULT '0'::numeric,
    due_amount numeric(12,2) DEFAULT '0'::numeric,
    bank_account_name text,
    bank_account_number text,
    bank_ifsc text,
    bank_name text,
    status public.franchisee_status DEFAULT 'pending'::public.franchisee_status NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.franchisees OWNER TO postgres;

--
-- Name: franchisees_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.franchisees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.franchisees_id_seq OWNER TO postgres;

--
-- Name: franchisees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.franchisees_id_seq OWNED BY public.franchisees.id;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id integer NOT NULL,
    invoice_number text NOT NULL,
    customer_id integer NOT NULL,
    subscription_id integer,
    booking_id integer,
    items json DEFAULT '[]'::json NOT NULL,
    subtotal numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    tax numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    discount numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    paid_amount numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    due_amount numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    status public.invoice_status DEFAULT 'draft'::public.invoice_status NOT NULL,
    due_date date,
    issued_at timestamp without time zone,
    paid_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.invoices OWNER TO postgres;

--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invoices_id_seq OWNER TO postgres;

--
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer,
    title text NOT NULL,
    message text NOT NULL,
    type public.notification_type NOT NULL,
    channel public.notification_channel DEFAULT 'in_app'::public.notification_channel NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    invoice_id integer,
    amount numeric(10,2) NOT NULL,
    method public.payment_method NOT NULL,
    transaction_id text,
    status public.payment_status DEFAULT 'completed'::public.payment_status NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payments_id_seq OWNER TO postgres;

--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: services; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.services (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    category public.service_category NOT NULL,
    base_price numeric(10,2) NOT NULL,
    duration_minutes integer,
    is_active boolean DEFAULT true NOT NULL,
    image_url text,
    features json DEFAULT '[]'::json,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.services OWNER TO postgres;

--
-- Name: services_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.services_id_seq OWNER TO postgres;

--
-- Name: services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.services_id_seq OWNED BY public.services.id;


--
-- Name: solar_sites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.solar_sites (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    address text NOT NULL,
    city text,
    panel_count integer NOT NULL,
    panel_capacity_kw numeric(8,2),
    installation_date date,
    last_cleaned_date date,
    next_service_date date,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.solar_sites OWNER TO postgres;

--
-- Name: solar_sites_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.solar_sites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.solar_sites_id_seq OWNER TO postgres;

--
-- Name: solar_sites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.solar_sites_id_seq OWNED BY public.solar_sites.id;


--
-- Name: staff; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff (
    id integer NOT NULL,
    user_id integer,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    role public.staff_role NOT NULL,
    branch_id integer NOT NULL,
    monthly_salary numeric(10,2),
    joining_date date,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    franchisee_id integer,
    local_address text,
    permanent_address text,
    guardian_name text,
    guardian_phone text,
    aadhaar text,
    pan text,
    bank_account_name text,
    bank_account_number text,
    bank_ifsc text,
    bank_passbook_url text,
    agreement_url text,
    verification_status public.staff_verification_status DEFAULT 'pending'::public.staff_verification_status NOT NULL,
    verification_notes text,
    verified_at timestamp without time zone
);


ALTER TABLE public.staff OWNER TO postgres;

--
-- Name: staff_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.staff_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.staff_id_seq OWNER TO postgres;

--
-- Name: staff_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.staff_id_seq OWNED BY public.staff.id;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscriptions (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    vehicle_id integer,
    solar_site_id integer,
    service_id integer,
    type public.subscription_type NOT NULL,
    status public.subscription_status DEFAULT 'active'::public.subscription_status NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    next_service_date date,
    frequency_days integer,
    price numeric(10,2) NOT NULL,
    paid_amount numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    due_amount numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    branch_id integer,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    cancelled_at timestamp without time zone,
    cancellation_remark text,
    message_sent_at timestamp without time zone
);


ALTER TABLE public.subscriptions OWNER TO postgres;

--
-- Name: subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subscriptions_id_seq OWNER TO postgres;

--
-- Name: subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subscriptions_id_seq OWNED BY public.subscriptions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    password_hash text NOT NULL,
    role public.user_role DEFAULT 'customer'::public.user_role NOT NULL,
    branch_id integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vehicles (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    make text NOT NULL,
    model text NOT NULL,
    year integer,
    color text,
    registration_number text NOT NULL,
    vehicle_type public.vehicle_type DEFAULT 'sedan'::public.vehicle_type,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vehicles OWNER TO postgres;

--
-- Name: vehicles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vehicles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vehicles_id_seq OWNER TO postgres;

--
-- Name: vehicles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vehicles_id_seq OWNED BY public.vehicles.id;


--
-- Name: attendance id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance ALTER COLUMN id SET DEFAULT nextval('public.attendance_id_seq'::regclass);


--
-- Name: bookings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings ALTER COLUMN id SET DEFAULT nextval('public.bookings_id_seq'::regclass);


--
-- Name: branches id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branches ALTER COLUMN id SET DEFAULT nextval('public.branches_id_seq'::regclass);


--
-- Name: complaints id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complaints ALTER COLUMN id SET DEFAULT nextval('public.complaints_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: franchisees id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.franchisees ALTER COLUMN id SET DEFAULT nextval('public.franchisees_id_seq'::regclass);


--
-- Name: invoices id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: services id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services ALTER COLUMN id SET DEFAULT nextval('public.services_id_seq'::regclass);


--
-- Name: solar_sites id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solar_sites ALTER COLUMN id SET DEFAULT nextval('public.solar_sites_id_seq'::regclass);


--
-- Name: staff id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff ALTER COLUMN id SET DEFAULT nextval('public.staff_id_seq'::regclass);


--
-- Name: subscriptions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions ALTER COLUMN id SET DEFAULT nextval('public.subscriptions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: vehicles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles ALTER COLUMN id SET DEFAULT nextval('public.vehicles_id_seq'::regclass);


--
-- Data for Name: attendance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.attendance (id, staff_id, date, status, check_in_time, check_out_time, notes, created_at) FROM stdin;
1	1	2026-05-05	present	09:15	18:30	\N	2026-05-06 04:38:34.16328
2	1	2026-05-04	late	09:15	18:30	\N	2026-05-06 04:38:34.16328
3	1	2026-05-03	present	09:15	18:30	\N	2026-05-06 04:38:34.16328
4	1	2026-05-02	present	09:15	18:30	\N	2026-05-06 04:38:34.16328
5	1	2026-05-01	present	09:15	18:30	\N	2026-05-06 04:38:34.16328
6	2	2026-05-05	late	09:15	18:30	\N	2026-05-06 04:38:34.16328
7	2	2026-05-04	late	09:15	18:30	\N	2026-05-06 04:38:34.16328
8	2	2026-05-03	present	09:15	18:30	\N	2026-05-06 04:38:34.16328
9	2	2026-05-02	present	09:15	18:30	\N	2026-05-06 04:38:34.16328
10	2	2026-05-01	present	09:15	18:30	\N	2026-05-06 04:38:34.16328
11	3	2026-05-05	present	09:15	18:30	\N	2026-05-06 04:38:34.16328
12	3	2026-05-04	present	09:15	18:30	\N	2026-05-06 04:38:34.16328
13	3	2026-05-03	present	09:15	18:30	\N	2026-05-06 04:38:34.16328
14	3	2026-05-02	present	09:15	18:30	\N	2026-05-06 04:38:34.16328
15	3	2026-05-01	present	09:15	18:30	\N	2026-05-06 04:38:34.16328
16	4	2026-05-05	late	09:15	18:30	\N	2026-05-06 04:38:34.16328
17	4	2026-05-04	present	09:15	18:30	\N	2026-05-06 04:38:34.16328
18	4	2026-05-03	late	09:15	18:30	\N	2026-05-06 04:38:34.16328
19	4	2026-05-02	present	09:15	18:30	\N	2026-05-06 04:38:34.16328
20	4	2026-05-01	present	09:15	18:30	\N	2026-05-06 04:38:34.16328
21	5	2026-05-05	present	09:15	18:30	\N	2026-05-06 04:38:34.16328
22	5	2026-05-04	late	09:15	18:30	\N	2026-05-06 04:38:34.16328
23	5	2026-05-03	present	09:15	18:30	\N	2026-05-06 04:38:34.16328
24	5	2026-05-02	present	09:15	18:30	\N	2026-05-06 04:38:34.16328
25	5	2026-05-01	present	09:15	18:30	\N	2026-05-06 04:38:34.16328
\.


--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bookings (id, customer_id, vehicle_id, solar_site_id, subscription_id, service_id, staff_id, branch_id, scheduled_date, scheduled_time, status, service_type, address, notes, completed_at, before_photo_url, after_photo_url, technician_notes, rating, amount, created_at, updated_at) FROM stdin;
2	2	3	\N	\N	2	2	1	2026-05-06	10:30	in_progress	car_wash	\N	\N	\N	\N	\N	\N	\N	599.00	2026-05-06 04:38:34.156474	2026-05-06 04:38:34.156474
5	5	6	\N	\N	1	1	1	2026-05-05	08:00	completed	car_wash	\N	\N	2026-05-05 05:38:34.153	\N	\N	Customer satisfied, car looks great	5	299.00	2026-05-06 04:38:34.156474	2026-05-06 04:38:34.156474
6	6	\N	1	\N	7	5	1	2026-05-05	09:00	completed	solar_cleaning	\N	\N	2026-05-05 06:38:34.153	\N	\N	\N	4	1499.00	2026-05-06 04:38:34.156474	2026-05-06 04:38:34.156474
7	7	8	\N	\N	2	6	2	2026-05-05	10:00	completed	car_wash	\N	\N	2026-05-05 07:38:34.153	\N	\N	\N	5	599.00	2026-05-06 04:38:34.156474	2026-05-06 04:38:34.156474
8	8	9	\N	\N	5	3	3	2026-05-08	10:00	confirmed	detailing	\N	\N	\N	\N	\N	\N	\N	19999.00	2026-05-06 04:38:34.156474	2026-05-06 04:38:34.156474
9	9	10	\N	\N	1	2	1	2026-05-06	14:00	pending	car_wash	\N	\N	\N	\N	\N	\N	\N	299.00	2026-05-06 04:38:34.156474	2026-05-06 04:38:34.156474
10	1	2	\N	\N	2	1	1	2026-05-05	16:00	completed	car_wash	\N	\N	2026-05-05 10:38:34.153	\N	\N	\N	5	599.00	2026-05-06 04:38:34.156474	2026-05-06 04:38:34.156474
11	10	\N	3	\N	7	5	2	2026-05-07	08:00	confirmed	solar_cleaning	\N	\N	\N	\N	\N	\N	\N	1499.00	2026-05-06 04:38:34.156474	2026-05-06 04:38:34.156474
12	12	12	\N	\N	3	1	1	2026-05-06	15:00	pending	detailing	\N	\N	\N	\N	\N	\N	\N	2499.00	2026-05-06 04:38:34.156474	2026-05-06 04:38:34.156474
1	1	1	\N	\N	1	1	1	2026-05-06	09:00	completed	car_wash	\N	\N	2026-05-08 06:18:42.003	\N	\N	\N	\N	299.00	2026-05-06 04:38:34.156474	2026-05-08 06:18:42.003
3	3	4	\N	\N	3	1	2	2026-05-06	11:00	confirmed	detailing	\N	\N	\N	\N	\N	\N	\N	2499.00	2026-05-06 04:38:34.156474	2026-05-08 06:18:44.093
4	4	5	\N	\N	4	3	3	2026-05-07	09:00	completed	detailing	\N	\N	2026-05-08 06:18:48.102	\N	\N	\N	\N	12999.00	2026-05-06 04:38:34.156474	2026-05-08 06:18:48.102
\.


--
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.branches (id, name, city, address, phone, manager_name, is_active, created_at, updated_at) FROM stdin;
1	CWP Varanasi	Varanasi	Lanka, Varanasi - 221005	0542-2500001	Rajesh Kumar	t	2026-05-06 04:38:34.091077	2026-05-06 04:38:34.091077
2	CWP Lucknow	Lucknow	Hazratganj, Lucknow - 226001	0522-3000001	Priya Singh	t	2026-05-06 04:38:34.091077	2026-05-06 04:38:34.091077
3	CWP Kanpur	Kanpur	Civil Lines, Kanpur - 208001	0512-2000001	Amit Gupta	t	2026-05-06 04:38:34.091077	2026-05-06 04:38:34.091077
\.


--
-- Data for Name: complaints; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.complaints (id, customer_id, booking_id, type, title, description, status, priority, resolution, resolved_at, created_at, updated_at) FROM stdin;
3	9	9	billing	Charged wrong amount	Was quoted Rs 299 but charged Rs 599. Please refund the difference.	resolved	high	Refund of Rs 300 processed to wallet.	2026-05-05 04:38:34.167	2026-05-06 04:38:34.167883	2026-05-06 04:38:34.167883
2	4	\N	delay	Technician arrived 2 hours late	Booked for 9 AM, technician arrived at 11 AM. No prior notice.	resolved	high	Resolved by admin	2026-05-06 05:06:36.179	2026-05-06 04:38:34.167883	2026-05-06 05:06:36.179
1	2	2	quality	Missed interior cleaning	The dashboard was not cleaned properly. Dust still visible on vents.	resolved	medium	Resolved by admin	2026-05-06 05:06:50.317	2026-05-06 04:38:34.167883	2026-05-06 05:06:50.317
4	1	\N	reclean	Water spots on car body	After washing, water spots appeared on the bonnet. Need reclean.	resolved	low	Resolved by admin	2026-05-06 05:06:53.545	2026-05-06 04:38:34.167883	2026-05-06 05:06:53.545
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, user_id, name, phone, email, address, city, status, wallet_balance, total_dues, branch_id, created_at, updated_at) FROM stdin;
1	\N	Arjun Sharma	9001001001	arjun@gmail.com	Lanka, Varanasi	Varanasi	active	500.00	0.00	1	2026-05-06 04:38:34.128141	2026-05-06 04:38:34.128141
2	\N	Sunita Patel	9001001002	sunita@gmail.com	Sigra, Varanasi	Varanasi	active	0.00	2499.00	1	2026-05-06 04:38:34.128141	2026-05-06 04:38:34.128141
3	\N	Vikram Singh	9001001003	vikram@gmail.com	Hazratganj, Lucknow	Lucknow	active	1000.00	0.00	2	2026-05-06 04:38:34.128141	2026-05-06 04:38:34.128141
4	\N	Kavita Mishra	9001001004	kavita@gmail.com	Civil Lines, Kanpur	Kanpur	active	0.00	4999.00	3	2026-05-06 04:38:34.128141	2026-05-06 04:38:34.128141
5	\N	Rohit Agarwal	9001001005	rohit@gmail.com	BHU Campus, Varanasi	Varanasi	active	2000.00	0.00	1	2026-05-06 04:38:34.128141	2026-05-06 04:38:34.128141
6	\N	Meena Gupta	9001001006	meena@gmail.com	Assi Ghat, Varanasi	Varanasi	active	0.00	14999.00	1	2026-05-06 04:38:34.128141	2026-05-06 04:38:34.128141
7	\N	Deepak Yadav	9001001007	deepak@gmail.com	Alambagh, Lucknow	Lucknow	active	750.00	0.00	2	2026-05-06 04:38:34.128141	2026-05-06 04:38:34.128141
8	\N	Anita Srivastava	9001001008	anita@gmail.com	Kakadeo, Kanpur	Kanpur	active	0.00	0.00	3	2026-05-06 04:38:34.128141	2026-05-06 04:38:34.128141
9	\N	Sanjay Tripathi	9001001009	sanjay@gmail.com	Rathyatra, Varanasi	Varanasi	active	300.00	599.00	1	2026-05-06 04:38:34.128141	2026-05-06 04:38:34.128141
10	\N	Pooja Chauhan	9001001010	pooja@gmail.com	Indira Nagar, Lucknow	Lucknow	active	1500.00	0.00	2	2026-05-06 04:38:34.128141	2026-05-06 04:38:34.128141
11	\N	Ramesh Verma	9001001011	ramesh@gmail.com	Cantonment, Kanpur	Kanpur	active	0.00	1499.00	3	2026-05-06 04:38:34.128141	2026-05-06 04:38:34.128141
12	\N	Geeta Tiwari	9001001012	geeta@gmail.com	Nadesar, Varanasi	Varanasi	active	800.00	0.00	1	2026-05-06 04:38:34.128141	2026-05-06 04:38:34.128141
13	4	Tushar Saraswat	7540077333	cwpdetailers@gmail.com	\N	Varanasi	active	0.00	0.00	\N	2026-05-08 05:49:15.922117	2026-05-08 05:49:15.922117
\.


--
-- Data for Name: franchisees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.franchisees (id, user_id, branch_id, name, phone, email, secondary_phone, current_address, permanent_address, aadhaar, pan, rent_agreement_url, franchisee_agreement_url, tenure_start_date, tenure_end_date, final_amount_agreed, amount_deposited, due_amount, bank_account_name, bank_account_number, bank_ifsc, bank_name, status, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoices (id, invoice_number, customer_id, subscription_id, booking_id, items, subtotal, tax, discount, total_amount, paid_amount, due_amount, status, due_date, issued_at, paid_at, created_at, updated_at) FROM stdin;
1	CWP-2026-1001	1	\N	\N	[{"description":"Daily Wash Subscription (3 months)","quantity":1,"unitPrice":8999,"total":8999}]	8999.00	0.00	0.00	8999.00	8999.00	0.00	paid	\N	2026-04-29 04:38:34.172	2026-04-29 04:38:34.172	2026-05-06 04:38:34.172985	2026-05-06 04:38:34.172985
2	CWP-2026-1002	2	\N	\N	[{"description":"Monthly Wash Subscription","quantity":1,"unitPrice":2499,"total":2499}]	2499.00	0.00	0.00	2499.00	0.00	2499.00	sent	2026-05-13	2026-05-03 04:38:34.177	\N	2026-05-06 04:38:34.177498	2026-05-06 04:38:34.177498
3	CWP-2026-1003	6	\N	\N	[{"description":"Solar AMC Annual Plan","quantity":1,"unitPrice":14999,"total":14999}]	14999.00	0.00	0.00	14999.00	0.00	14999.00	overdue	2026-04-21	2026-04-06 04:38:34.18	\N	2026-05-06 04:38:34.181252	2026-05-06 04:38:34.181252
4	CWP-2026-1004	5	\N	\N	[{"description":"Basic Wash x 5","quantity":5,"unitPrice":299,"total":1495}]	1495.00	0.00	0.00	1495.00	1495.00	0.00	paid	\N	2026-05-04 04:38:34.185	2026-05-05 04:38:34.185	2026-05-06 04:38:34.185889	2026-05-06 04:38:34.185889
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, title, message, type, channel, is_read, created_at) FROM stdin;
1	1	Welcome to CWP Platform	Your admin account is ready. Explore the dashboard to get started.	broadcast	in_app	f	2026-05-06 04:38:34.193462
2	\N	Subscription Expiring Soon	3 customer subscriptions expire within 7 days. Take action.	subscription_expiry	in_app	f	2026-05-06 04:38:34.193462
4	\N	New Complaint Filed	High priority complaint from Vikram Singh regarding delayed service.	complaint_update	in_app	f	2026-05-06 04:38:34.193462
3	\N	Outstanding Dues Alert	Total pending dues: Rs 17,498. Review the outstanding report.	payment_reminder	in_app	t	2026-05-06 04:38:34.193462
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (id, customer_id, invoice_id, amount, method, transaction_id, status, notes, created_at) FROM stdin;
1	1	1	8999.00	upi	TXN20260430001	completed	\N	2026-05-06 04:38:34.189363
2	5	4	1495.00	cash	\N	completed	\N	2026-05-06 04:38:34.189363
3	3	\N	2499.00	upi	TXN20260502001	completed	\N	2026-05-06 04:38:34.189363
4	7	\N	599.00	razorpay	TXN20260503001	completed	\N	2026-05-06 04:38:34.189363
5	2454	\N	6454.00	upi	\N	completed	\N	2026-05-06 05:06:15.234325
\.


--
-- Data for Name: services; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.services (id, name, description, category, base_price, duration_minutes, is_active, image_url, features, created_at, updated_at) FROM stdin;
3	Interior Detailing	Deep interior cleaning with steam, shampoo, and leather conditioning.	detailing	2499.00	240	t	\N	["Steam cleaning","Carpet shampoo","Leather conditioning","Odor removal","Dashboard polish"]	2026-05-06 04:38:34.121226	2026-05-06 04:38:34.121226
4	Full Car Detailing	Complete exterior + interior detailing for showroom-quality finish.	detailing	4999.00	360	t	\N	["Exterior clay bar","Machine polish","Interior steam","Leather care","Tyre shine","Engine bay clean"]	2026-05-06 04:38:34.121226	2026-05-06 04:38:34.121226
5	Ceramic Coating (Entry)	1-year SiO2 ceramic coating for lasting paint protection.	ceramic_coating	12999.00	480	t	\N	["SiO2 coating","1-year protection","UV resistance","Hydrophobic layer","Polish before coat"]	2026-05-06 04:38:34.121226	2026-05-06 04:38:34.121226
6	Ceramic Coating (Pro)	3-year professional ceramic coating with graphene top layer.	ceramic_coating	24999.00	600	t	\N	["Graphene + SiO2","3-year warranty","Self-healing properties","Deep paint correction","10H hardness"]	2026-05-06 04:38:34.121226	2026-05-06 04:38:34.121226
7	PPF Installation	Paint Protection Film for hoods, bumpers, and high-impact areas.	ppf	19999.00	720	t	\N	["Self-healing film","UV protection","Rock chip resistance","Invisible finish","5-year warranty"]	2026-05-06 04:38:34.121226	2026-05-06 04:38:34.121226
1	Daily Exterior Car Clean	Daily exterior wash every morning. Foam clean, rinse, wipe, and tyre shine — before you leave for work.	car_wash	1000.00	45	t	\N	["Daily exterior wash","Foam clean & rinse","Tyre shine","Window wipe","Available 8–10 AM"]	2026-05-06 04:38:34.121226	2026-05-06 07:13:17.823
2	1 Time Wash (Monthly)	One full wash per month including interior vacuum, foam wash, and glass cleaning.	car_wash	600.00	90	t	\N	["1 full wash/month","Foam wash","Interior vacuum","Glass cleaning","Tyre polish"]	2026-05-06 04:38:34.121226	2026-05-06 07:13:17.918
8	Solar Panel Cleaning (One-Time)	Professional single-visit solar panel cleaning using deionised water and soft brushes. Zero scratches, zero residue.	solar_cleaning	1800.00	120	t	\N	["Soft brush + DM water","Panel inspection","No scratches or residue","Efficiency report","1-30 panels: ₹60/panel","30-100 panels: ₹50/panel"]	2026-05-06 04:38:34.121226	2026-05-06 07:13:17.957
9	Solar Cleaning AMC (12 Months)	Annual maintenance contract for solar panels — 12 cleanings/year at discounted per-panel rates. Best ROI for serious solar owners.	amc	10800.00	120	t	\N	["12 cleanings/year","1-30 panels: ₹45/panel","30-100 panels: ₹40/panel","Priority scheduling","Panel health report","WhatsApp job updates","GST extra"]	2026-05-06 04:38:34.121226	2026-05-06 07:13:17.997
\.


--
-- Data for Name: solar_sites; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.solar_sites (id, customer_id, address, city, panel_count, panel_capacity_kw, installation_date, last_cleaned_date, next_service_date, created_at, updated_at) FROM stdin;
1	6	Assi Ghat, Varanasi	Varanasi	20	10.00	\N	\N	2026-05-15	2026-05-06 04:38:34.137629	2026-05-06 04:38:34.137629
2	4	Civil Lines, Kanpur	Kanpur	12	6.00	\N	\N	2026-05-20	2026-05-06 04:38:34.137629	2026-05-06 04:38:34.137629
3	10	Indira Nagar, Lucknow	Lucknow	16	8.00	\N	\N	2026-06-01	2026-05-06 04:38:34.137629	2026-05-06 04:38:34.137629
4	11	Cantonment, Kanpur	Kanpur	8	4.00	\N	\N	2026-05-25	2026-05-06 04:38:34.137629	2026-05-06 04:38:34.137629
\.


--
-- Data for Name: staff; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.staff (id, user_id, name, phone, email, role, branch_id, monthly_salary, joining_date, is_active, created_at, updated_at, franchisee_id, local_address, permanent_address, guardian_name, guardian_phone, aadhaar, pan, bank_account_name, bank_account_number, bank_ifsc, bank_passbook_url, agreement_url, verification_status, verification_notes, verified_at) FROM stdin;
3	\N	Manoj Pandey	9011001003	manoj@cwp.com	supervisor	1	25000.00	2022-10-01	t	2026-05-06 04:38:34.14235	2026-05-06 04:38:34.14235	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	pending	\N	\N
4	\N	Arun Gupta	9011001004	arun@cwp.com	driver	1	15000.00	2024-01-10	t	2026-05-06 04:38:34.14235	2026-05-06 04:38:34.14235	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	pending	\N	\N
5	\N	Ashok Singh	9011001005	ashok@cwp.com	solar_technician	1	22000.00	2023-03-20	t	2026-05-06 04:38:34.14235	2026-05-06 04:38:34.14235	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	pending	\N	\N
6	\N	Preetam Shah	9011001006	preetam@cwp.com	technician	2	18000.00	2024-02-01	t	2026-05-06 04:38:34.14235	2026-05-06 04:38:34.14235	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	pending	\N	\N
7	\N	Dinesh Verma	9011001007	dinesh@cwp.com	supervisor	2	25000.00	2022-11-15	t	2026-05-06 04:38:34.14235	2026-05-06 04:38:34.14235	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	pending	\N	\N
8	\N	Sonu Patel	9011001008	sonu@cwp.com	solar_technician	3	22000.00	2023-07-01	t	2026-05-06 04:38:34.14235	2026-05-06 04:38:34.14235	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	pending	\N	\N
1	5	Ravi Kumar	9011001001	ravi@cwp.com	technician	1	18000.00	2023-06-01	t	2026-05-06 04:38:34.14235	2026-05-08 06:31:29.288	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	verified		2026-05-08 06:30:59.334
2	6	Suresh Yadav	9011001002	suresh@cwp.com	technician	1	18000.00	2023-08-15	t	2026-05-06 04:38:34.14235	2026-05-08 06:33:33.158	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	verified		2026-05-08 06:33:23.834
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscriptions (id, customer_id, vehicle_id, solar_site_id, service_id, type, status, start_date, end_date, next_service_date, frequency_days, price, paid_amount, due_amount, branch_id, notes, created_at, updated_at, cancelled_at, cancellation_remark, message_sent_at) FROM stdin;
1	1	\N	\N	1	daily_wash	active	2026-05-06	2026-08-04	2026-05-06	1	8999.00	8999.00	0.00	1	\N	2026-05-06 04:38:34.14945	2026-05-06 04:38:34.14945	\N	\N	\N
2	2	\N	\N	2	monthly_wash	active	2026-05-06	2026-06-05	2026-05-06	7	2499.00	0.00	2499.00	1	\N	2026-05-06 04:38:34.14945	2026-05-06 04:38:34.14945	\N	\N	\N
3	6	\N	\N	7	solar_amc	active	2026-01-01	2026-12-31	2026-05-15	30	14999.00	0.00	14999.00	1	\N	2026-05-06 04:38:34.14945	2026-05-06 04:38:34.14945	\N	\N	\N
4	3	\N	\N	2	monthly_wash	active	2026-05-06	2026-06-05	2026-05-06	7	2499.00	2499.00	0.00	2	\N	2026-05-06 04:38:34.14945	2026-05-06 04:38:34.14945	\N	\N	\N
5	5	\N	\N	1	daily_wash	active	2026-05-06	2026-05-13	2026-05-06	1	999.00	999.00	0.00	1	\N	2026-05-06 04:38:34.14945	2026-05-06 04:38:34.14945	\N	\N	\N
6	10	\N	\N	7	solar_amc	active	2026-02-01	2027-01-31	2026-06-01	30	14999.00	14999.00	0.00	2	\N	2026-05-06 04:38:34.14945	2026-05-06 04:38:34.14945	\N	\N	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, phone, email, password_hash, role, branch_id, is_active, created_at, updated_at) FROM stdin;
1	Admin CWP	9999999999	admin@cwpdetailers.com	30c3fb8a95047283d3eda2f11ccbe35c595c6b02b1bbacf89094140d93e3bb4c	admin	1	t	2026-05-06 04:38:34.116006	2026-05-06 04:38:34.116006
2	Rajesh Kumar	9876543210	rajesh@cwpdetailers.com	d1aa4386475e843d88d2ee04a12f6b36012ed6879277942b2baf0efa31ae2326	staff	1	t	2026-05-06 04:38:34.116006	2026-05-06 04:38:34.116006
3	Priya Singh	9876543211	priya@cwpdetailers.com	d1aa4386475e843d88d2ee04a12f6b36012ed6879277942b2baf0efa31ae2326	staff	2	t	2026-05-06 04:38:34.116006	2026-05-06 04:38:34.116006
4	Tushar Saraswat	7540077333	cwpdetailers@gmail.com	cacf2c3881c894f137c88092f647f49407569d6eeec4aed6a211bf9ea5c596b2	customer	\N	t	2026-05-08 05:49:15.614205	2026-05-08 05:49:15.614205
5	Ravi Kumar	9011001001	ravi@cwp.com	e9cee71ab932fde863338d08be4de9dfe39ea049bdafb342ce659ec5450b69ae	staff	1	t	2026-05-08 06:31:29.285233	2026-05-08 06:31:29.285233
6	Suresh Yadav	9011001002	suresh@cwp.com	240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9	staff	1	t	2026-05-08 06:33:33.153668	2026-05-08 06:33:33.153668
\.


--
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vehicles (id, customer_id, make, model, year, color, registration_number, vehicle_type, created_at, updated_at) FROM stdin;
1	1	Maruti	Swift	2021	Red	UP65AA1234	hatchback	2026-05-06 04:38:34.13369	2026-05-06 04:38:34.13369
2	1	Honda	City	2022	White	UP65AB5678	sedan	2026-05-06 04:38:34.13369	2026-05-06 04:38:34.13369
3	2	Hyundai	Creta	2023	Black	UP65AC9012	suv	2026-05-06 04:38:34.13369	2026-05-06 04:38:34.13369
4	3	Tata	Nexon	2022	Blue	UP32CD3456	suv	2026-05-06 04:38:34.13369	2026-05-06 04:38:34.13369
5	4	Toyota	Fortuner	2021	White	UP78EF7890	suv	2026-05-06 04:38:34.13369	2026-05-06 04:38:34.13369
6	5	BMW	3 Series	2023	Silver	UP65GH2345	luxury	2026-05-06 04:38:34.13369	2026-05-06 04:38:34.13369
7	6	Mercedes	C-Class	2022	Black	UP65IJ6789	luxury	2026-05-06 04:38:34.13369	2026-05-06 04:38:34.13369
8	7	Kia	Seltos	2023	Grey	UP32KL1234	suv	2026-05-06 04:38:34.13369	2026-05-06 04:38:34.13369
9	8	Mahindra	Scorpio N	2023	Red	UP78MN5678	suv	2026-05-06 04:38:34.13369	2026-05-06 04:38:34.13369
10	9	Maruti	Dzire	2020	White	UP65OP9012	sedan	2026-05-06 04:38:34.13369	2026-05-06 04:38:34.13369
11	10	Volkswagen	Polo	2021	Blue	UP32QR3456	hatchback	2026-05-06 04:38:34.13369	2026-05-06 04:38:34.13369
12	12	Skoda	Octavia	2022	Black	UP65ST7890	sedan	2026-05-06 04:38:34.13369	2026-05-06 04:38:34.13369
\.


--
-- Name: attendance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.attendance_id_seq', 25, true);


--
-- Name: bookings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.bookings_id_seq', 12, true);


--
-- Name: branches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.branches_id_seq', 3, true);


--
-- Name: complaints_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.complaints_id_seq', 4, true);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customers_id_seq', 13, true);


--
-- Name: franchisees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.franchisees_id_seq', 1, false);


--
-- Name: invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.invoices_id_seq', 4, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 4, true);


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payments_id_seq', 5, true);


--
-- Name: services_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.services_id_seq', 9, true);


--
-- Name: solar_sites_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.solar_sites_id_seq', 4, true);


--
-- Name: staff_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.staff_id_seq', 8, true);


--
-- Name: subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscriptions_id_seq', 6, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 6, true);


--
-- Name: vehicles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vehicles_id_seq', 12, true);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: complaints complaints_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: franchisees franchisees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.franchisees
    ADD CONSTRAINT franchisees_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: solar_sites solar_sites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solar_sites
    ADD CONSTRAINT solar_sites_pkey PRIMARY KEY (id);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_phone_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_unique UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict lH1HO0Y4j7ongQ8aKh2irv02JDkeokoGU4TxuGLdnRcuUj9lrSS89uWXxjuK8gr

