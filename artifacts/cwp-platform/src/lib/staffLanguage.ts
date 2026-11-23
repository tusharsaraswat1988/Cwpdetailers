import { useState, useEffect, useSyncExternalStore } from "react";

export type StaffLanguage = "hi" | "en";

const STORAGE_KEY = "cwp_staff_language_preference";
let currentLang: StaffLanguage = "hi"; // Default Hindi-first per operational requirements

const listeners = new Set<() => void>();

function getInitialLanguage(): StaffLanguage {
  if (typeof window === "undefined") return "hi";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "hi" || saved === "en") return saved;
  } catch {
    // fallback
  }
  return "hi";
}

currentLang = getInitialLanguage();

export function getStaffLanguage(): StaffLanguage {
  return currentLang;
}

export function setStaffLanguage(lang: StaffLanguage): void {
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore
  }
  listeners.forEach(l => l());
}

export function subscribeStaffLanguage(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function useStaffLanguage(): {
  lang: StaffLanguage;
  setLang: (lang: StaffLanguage) => void;
  isHindi: boolean;
  t: (key: TranslationKey) => string;
} {
  const lang = useSyncExternalStore(subscribeStaffLanguage, getStaffLanguage, () => "hi");
  return {
    lang,
    setLang: setStaffLanguage,
    isHindi: lang === "hi",
    t: (key: TranslationKey) => translate(key, lang),
  };
}

export type TranslationKey =
  // Bottom Navigation
  | "nav_dashboard"
  | "nav_dcms"
  | "nav_other_jobs"
  | "nav_account"
  // Attendance & Shift
  | "attendance_shift"
  | "attendance_check_in"
  | "attendance_checked_in"
  | "attendance_not_checked_in"
  | "attendance_checking_in"
  | "attendance_verified"
  // Daily Clean & Progress
  | "progress_title"
  | "progress_summary"
  | "filter_all"
  | "filter_pending"
  | "filter_completed"
  | "filter_exceptions"
  | "pending_vehicles_title"
  | "completed_vehicles_title"
  | "no_pending_vehicles"
  | "no_completed_vehicles"
  | "no_assignments_today"
  | "no_assignments_desc"
  | "complete_cleaning_action"
  | "cleaning_in_progress"
  | "cleaning_complete"
  | "car_not_available_action"
  | "car_found_clean_now"
  | "options"
  | "change"
  | "directions"
  | "copy_address"
  | "address_copied"
  | "search_plate_placeholder"
  // Photo & Location Proof
  | "photo_take_near_car"
  | "photo_scanning_plate"
  | "photo_uploading"
  | "photo_success"
  | "photo_failed_retry"
  | "loc_not_found_retry"
  | "loc_searching"
  | "plate_match_success"
  | "plate_mismatch_warning"
  | "manual_plate_prompt"
  | "manual_plate_match_error"
  | "confirm_plate_btn"
  // Dashboard Hero & Next Task
  | "next_task_hero"
  | "all_tasks_completed_title"
  | "all_tasks_completed_desc"
  | "action_start"
  | "action_clean"
  | "my_other_jobs_title"
  | "other_jobs_pending"
  | "other_jobs_none"
  | "call_customer"
  | "accept_job"
  | "on_my_way"
  | "arrived"
  // Account & Profile
  | "account_title"
  | "my_shifts"
  | "earnings_payouts"
  | "language_toggle"
  | "language_hindi"
  | "language_english"
  | "logout"
  | "supervisor_contact"
  | "my_documents"
  | "app_version"
  | "session_active"
  | "field_support"
  | "field_support_desc"
  | "call_support"
  | "logout_confirm_title"
  | "logout_confirm_desc"
  | "logout_confirm_btn"
  | "logout_cancel_btn"
  // General & Lifecycle Stepper
  | "retry"
  | "loading"
  | "back"
  | "bay"
  | "tower"
  | "flat"
  | "start_work"
  | "service_done_after_photos"
  | "submit_complete_job"
  | "resume_work"
  | "pause_work"
  | "work_paused"
  | "booking_accepted"
  | "before_photos_uploaded"
  | "service_in_progress"
  | "technician_notes"
  | "before_photos_label"
  | "after_photos_label"
  | "step_route"
  | "step_before"
  | "step_work"
  | "step_after"
  | "step_done"
  // Android Camera & GPS Operational Recovery (Phase P6)
  | "camera_permission_denied"
  | "camera_unavailable"
  | "camera_cancelled"
  | "retake_photo"
  | "confirm_photo_btn"
  | "photo_preview_title"
  | "gps_verified"
  | "gps_basement_fallback"
  | "gps_weak_warning"
  | "gps_permission_denied"
  | "open_app_settings"
  | "offline_saved_toast"
  // Operational Exceptions & Checklist Integrity (Phase P9)
  | "report_issue_btn"
  | "checklist_progress"
  | "checklist_steps_done"
  | "checklist_required_helper"
  | "job_missed_title"
  | "job_missed_desc"
  | "recorded_exception_notes";

const translations: Record<StaffLanguage, Record<TranslationKey, string>> = {
  hi: {
    nav_dashboard: "डैशबोर्ड",
    nav_dcms: "रोज़ाना सफाई",
    nav_other_jobs: "अन्य काम",
    nav_account: "खाता",

    attendance_shift: "आज की हाजिरी",
    attendance_check_in: "हाजिरी लगाएं",
    attendance_checked_in: "हाजिरी लग गई",
    attendance_not_checked_in: "हाजिरी नहीं लगी",
    attendance_checking_in: "हाजिरी लग रही है…",
    attendance_verified: "वेरिफाइड",

    progress_title: "आज का काम",
    progress_summary: "गाड़ियां साफ हुईं",
    filter_all: "सभी",
    filter_pending: "बाकी",
    filter_completed: "सफाई पूरी",
    filter_exceptions: "नहीं मिली",
    pending_vehicles_title: "सफाई के लिए बाकी गाड़ियां",
    completed_vehicles_title: "सफाई पूरी हो चुकी गाड़ियां",
    no_pending_vehicles: "बहुत बढ़िया! सफाई के लिए कोई गाड़ी बाकी नहीं है।",
    no_completed_vehicles: "अभी तक कोई गाड़ी पूरी नहीं हुई है।",
    no_assignments_today: "आज कोई गाड़ी असाइन नहीं है",
    no_assignments_desc: "जब सुपरवाइजर गाड़ी जोड़ेगा, यहां लिस्ट दिखेगी।",
    complete_cleaning_action: "सफाई पूरी करें",
    cleaning_in_progress: "सफाई हो रही है…",
    cleaning_complete: "सफाई पूरी हो गई",
    car_not_available_action: "गाड़ी नहीं मिली",
    car_found_clean_now: "गाड़ी मिल गई — सफाई करें",
    options: "अन्य विकल्प",
    change: "बदलें",
    directions: "रास्ता देखें",
    copy_address: "पता कॉपी करें",
    address_copied: "पता कॉपी हो गया",
    search_plate_placeholder: "गाड़ी नंबर से खोजें (जैसे 1234)...",

    photo_take_near_car: "गाड़ी के पास जाकर फोटो लें।",
    photo_scanning_plate: "नंबर प्लेट जांची जा रही है…",
    photo_uploading: "फोटो भेजी जा रही है…",
    photo_success: "सफाई पूरी हो गई!",
    photo_failed_retry: "काम सेव नहीं हुआ। फिर कोशिश करें।",
    loc_not_found_retry: "लोकेशन नहीं मिल रही। फिर कोशिश करें।",
    loc_searching: "लोकेशन जांची जा रही है…",
    plate_match_success: "गाड़ी नंबर सही मिला!",
    plate_mismatch_warning: "यह दूसरी गाड़ी का नंबर है। कृपया असाइन की गई गाड़ी की फोटो लें।",
    manual_plate_prompt: "नंबर साफ नहीं दिखा। नीचे गाड़ी नंबर लिखें:",
    manual_plate_match_error: "यह नंबर असाइन की गई गाड़ी से मेल नहीं खाता।",
    confirm_plate_btn: "नंबर कन्फर्म करें",

    next_task_hero: "अगला काम",
    all_tasks_completed_title: "आज का सारा काम पूरा हो गया!",
    all_tasks_completed_desc: "शाबाश! आपने आज की सभी असाइन गाड़ियां साफ कर ली हैं।",
    action_start: "काम शुरू करें",
    action_clean: "सफाई करें",
    my_other_jobs_title: "अन्य बुकिंग / काम",
    other_jobs_pending: "काम बाकी हैं",
    other_jobs_none: "आज कोई अन्य बुकिंग नहीं है",
    call_customer: "ग्राहक को कॉल करें",
    accept_job: "काम स्वीकार करें",
    on_my_way: "निकल रहे हैं (On My Way)",
    arrived: "पहुंच गए",

    account_title: "मेरी प्रोफाइल और खाता",
    my_shifts: "मेरी हाजिरी और शिफ्ट्स",
    earnings_payouts: "कमाई और भुगतान (Earnings)",
    language_toggle: "भाषा बदलें (Language)",
    language_hindi: "हिन्दी",
    language_english: "English",
    logout: "लॉगआउट करें",
    supervisor_contact: "सुपरवाइजर से संपर्क करें",
    my_documents: "मेरे दस्तावेज",
    app_version: "ऐप वर्शन",
    session_active: "सक्रिय सत्र (लॉगिन सुरक्षित)",
    field_support: "फील्ड सपोर्ट व सहायता",
    field_support_desc: "रूट में बदलाव या फील्ड में किसी आपात समस्या के लिए तुरंत संपर्क करें",
    call_support: "सपोर्ट को कॉल करें",
    logout_confirm_title: "लॉगआउट करना चाहते हैं?",
    logout_confirm_desc: "क्या आप स्टाफ ऐप से लॉगआउट करना चाहते हैं? आपका आज का अटेंडेंस और सिंक हुआ काम पूरी तरह सुरक्षित रहेगा।",
    logout_confirm_btn: "हाँ, लॉगआउट करें",
    logout_cancel_btn: "नहीं, वापस जाएं",

    retry: "फिर कोशिश करें",
    loading: "लोड हो रहा है…",
    back: "पीछे जाएं",
    bay: "बे",
    tower: "टावर",
    flat: "फ्लैट",
    start_work: "काम शुरू करें",
    service_done_after_photos: "सफाई पूरी — बाद की फोटो लें",
    submit_complete_job: "सबमिट करें — काम पूरा हुआ",
    resume_work: "काम दोबारा शुरू करें",
    pause_work: "काम रोकें (Pause)",
    work_paused: "काम रुका हुआ है",
    booking_accepted: "बुकिंग स्वीकार की गई",
    before_photos_uploaded: "शुरू करने से पहले की फोटो ले ली गई",
    service_in_progress: "सफाई चल रही है",
    technician_notes: "टिप्पणी / ऑब्जर्वेशन (वैकल्पिक)",
    before_photos_label: "शुरू से पहले की फोटो (सबूत)",
    after_photos_label: "सफाई के बाद की फोटो (सबूत)",
    step_route: "रास्ता",
    step_before: "पहले",
    step_work: "सफाई",
    step_after: "बाद में",
    step_done: "पूरा",

    camera_permission_denied: "कैमरा परमिशन बंद है। ऐप सेटिंग्स में जाकर ऑन करें।",
    camera_unavailable: "कैमरा शुरू नहीं हो सका। कृपया ऐप दोबारा खोलें।",
    camera_cancelled: "फोटो लेना रद्द किया गया।",
    retake_photo: "दोबारा फोटो लें",
    confirm_photo_btn: "यह फोटो सही है — सेव करें",
    photo_preview_title: "फोटो की जांच करें",
    gps_verified: "GPS वेरिफाइड",
    gps_basement_fallback: "कैंपस लोकेशन (बेसमेंट)",
    gps_weak_warning: "कमजोर GPS सिग्नल",
    gps_permission_denied: "लोकेशन परमिशन बंद है",
    open_app_settings: "फोन सेटिंग्स खोलें",
    offline_saved_toast: "फोन में सुरक्षित सेव हुआ — ऑनलाइन आते ही सिंक होगा",

    report_issue_btn: "समस्या रिपोर्ट करें / काम नहीं हो सका",
    checklist_progress: "सर्विस चेकलिस्ट",
    checklist_steps_done: "स्टेप्स पूरे",
    checklist_required_helper: "आगे बढ़ने के लिए सभी चेकलिस्ट स्टेप्स पर सही का निशान लगाएं।",
    job_missed_title: "काम एक्सेप्शन / नहीं हो सका",
    job_missed_desc: "यह काम एक्सेप्शन के रूप में दर्ज हो चुका है। आपके आज के बचे हुए काम नीचे दिए गए हैं या सुपरवाइजर से बात करें।",
    recorded_exception_notes: "दर्ज कारण / नोट्स",
  },
  en: {
    nav_dashboard: "Dashboard",
    nav_dcms: "DCMS Route",
    nav_other_jobs: "My Other Jobs",
    nav_account: "Account",

    attendance_shift: "Today's Shift Attendance",
    attendance_check_in: "Check In",
    attendance_checked_in: "Checked In",
    attendance_not_checked_in: "Not Checked In",
    attendance_checking_in: "Checking in…",
    attendance_verified: "Verified",

    progress_title: "Today's Progress",
    progress_summary: "Cars Cleaned",
    filter_all: "All",
    filter_pending: "Pending",
    filter_completed: "Cleaned",
    filter_exceptions: "Exceptions",
    pending_vehicles_title: "Pending Vehicles",
    completed_vehicles_title: "Completed Vehicles",
    no_pending_vehicles: "Great job! All pending cleanings are complete.",
    no_completed_vehicles: "No vehicles cleaned yet today.",
    no_assignments_today: "No daily cleaning assignments today",
    no_assignments_desc: "Assigned vehicles will appear here once allocated.",
    complete_cleaning_action: "Complete Cleaning",
    cleaning_in_progress: "Cleaning…",
    cleaning_complete: "Clean Completed",
    car_not_available_action: "Car Not Available",
    car_found_clean_now: "Car Found — Clean Now",
    options: "Options",
    change: "Change",
    directions: "Directions",
    copy_address: "Copy Address",
    address_copied: "Address copied",
    search_plate_placeholder: "Search plate number (e.g. 1234)...",

    photo_take_near_car: "Take photo standing near the car.",
    photo_scanning_plate: "Verifying number plate…",
    photo_uploading: "Uploading photo proof…",
    photo_success: "Cleaning completed successfully!",
    photo_failed_retry: "Work not saved. Please try again.",
    loc_not_found_retry: "Location not found. Please try again.",
    loc_searching: "Verifying GPS location…",
    plate_match_success: "Number plate verified!",
    plate_mismatch_warning: "Different vehicle detected. Please photograph the assigned vehicle.",
    manual_plate_prompt: "Plate could not be read clearly. Enter registration number:",
    manual_plate_match_error: "Entered number does not match assigned vehicle.",
    confirm_plate_btn: "Confirm Plate Number",

    next_task_hero: "Next Task",
    all_tasks_completed_title: "All Tasks Complete for Today!",
    all_tasks_completed_desc: "Great job! You have completed all assigned vehicle tasks.",
    action_start: "Start Service",
    action_clean: "Clean Vehicle",
    my_other_jobs_title: "Other Service Bookings",
    other_jobs_pending: "jobs pending",
    other_jobs_none: "No other service bookings today",
    call_customer: "Call Customer",
    accept_job: "Accept Job",
    on_my_way: "On My Way",
    arrived: "I Have Arrived",

    account_title: "My Account & Profile",
    my_shifts: "Attendance & Shifts",
    earnings_payouts: "Earnings & Payouts",
    language_toggle: "Change Language",
    language_hindi: "हिन्दी",
    language_english: "English",
    logout: "Log Out",
    supervisor_contact: "Contact Supervisor",
    my_documents: "My Documents",
    app_version: "App Version",
    session_active: "Active Session (Secure)",
    field_support: "Field Support & Assistance",
    field_support_desc: "Contact operations for route adjustments or urgent field help",
    call_support: "Call Support",
    logout_confirm_title: "Log out from CWP Staff?",
    logout_confirm_desc: "Are you sure you want to log out? Your attendance and synced work remain completely safe.",
    logout_confirm_btn: "Yes, Log Out",
    logout_cancel_btn: "Cancel",

    retry: "Try Again",
    loading: "Loading…",
    back: "Back",
    bay: "Bay",
    tower: "Tower",
    flat: "Flat",
    start_work: "Start Work",
    service_done_after_photos: "Service Done — After Photos",
    submit_complete_job: "Submit & Complete Job",
    resume_work: "Resume Work",
    pause_work: "Pause Work",
    work_paused: "Work Paused",
    booking_accepted: "Booking Accepted",
    before_photos_uploaded: "Before Photos Uploaded",
    service_in_progress: "Service In Progress",
    technician_notes: "Technician Notes & Observations (Optional)",
    before_photos_label: "Before Photos (Evidence)",
    after_photos_label: "After Photos (Clean Proof)",
    step_route: "Route",
    step_before: "Before",
    step_work: "Work",
    step_after: "After",
    step_done: "Done",

    camera_permission_denied: "Camera permission denied. Enable it in phone settings.",
    camera_unavailable: "Camera could not be started. Please relaunch the app.",
    camera_cancelled: "Photo capture cancelled.",
    retake_photo: "Retake Photo",
    confirm_photo_btn: "Looks Good — Save",
    photo_preview_title: "Preview & Verify Photo",
    gps_verified: "GPS Verified",
    gps_basement_fallback: "Campus Location (Basement)",
    gps_weak_warning: "Weak GPS Signal",
    gps_permission_denied: "Location Permission Denied",
    open_app_settings: "Open Settings",
    offline_saved_toast: "Saved locally on phone — will sync automatically when online",

    report_issue_btn: "Report Issue / Cannot Complete",
    checklist_progress: "Service Checklist",
    checklist_steps_done: "Steps Done",
    checklist_required_helper: "Please check off all required checklist steps before proceeding.",
    job_missed_title: "Job Missed / Exception",
    job_missed_desc: "This job has been marked as an exception. Please proceed with remaining jobs or contact your supervisor.",
    recorded_exception_notes: "Recorded Reason / Notes",
  },
};

export function formatStaffOperationalError(err: unknown, isHindi = true): { title: string; description: string } {
  const msg = err instanceof Error ? err.message : String(err || "");
  const lower = msg.toLowerCase();

  if (/missed|exception|cannot complete|unable to execute/i.test(lower)) {
    return {
      title: isHindi ? "एक्सेप्शन दर्ज हुआ" : "Exception Recorded",
      description: isHindi
        ? "यह काम एक्सेप्शन के तौर पर दर्ज किया गया है। सुपरवाइजर को अपडेट मिल गया है।"
        : "Job recorded as exception. Operations has been notified.",
    };
  }

  if (/permission|camera access|not allowed/i.test(lower)) {
    return {
      title: isHindi ? "कैमरा परमिशन बंद है" : "Camera Permission Denied",
      description: isHindi
        ? "ऐप सेटिंग्स में जाकर कैमरा चालू करें। आपका काम सुरक्षित है।"
        : "Enable camera access in device settings. Your progress is safe.",
    };
  }

  if (/location.*permission|denied.*location/i.test(lower)) {
    return {
      title: isHindi ? "लोकेशन परमिशन बंद है" : "Location Permission Denied",
      description: isHindi
        ? "फोन सेटिंग्स में लोकेशन ऑन करें। आपका काम सुरक्षित है।"
        : "Enable location in device settings. Your progress is safe.",
    };
  }

  if (/network|offline|failed to fetch|timeout|abort/i.test(lower)) {
    return {
      title: isHindi ? "इंटरनेट कमजोर है" : "Weak Connection",
      description: isHindi
        ? "काम फोन में सुरक्षित सेव हो गया है। नेटवर्क आते ही अपने आप सिंक होगा।"
        : "Saved locally on phone. It will automatically sync once online.",
    };
  }

  if (/geofence|away|150m/i.test(lower)) {
    return {
      title: isHindi ? "कस्टमर लोकेशन से दूर हैं" : "Location Verification Required",
      description: isHindi
        ? "कृपया गाड़ी या सर्विस लोकेशन के पास जाकर दोबारा प्रयास करें।"
        : "Please step closer to the service vehicle location and try again.",
    };
  }

  if (/session|unauthorized|401|expired/i.test(lower)) {
    return {
      title: isHindi ? "सेशन समाप्त हो गया" : "Session Expired",
      description: isHindi
        ? "कृपया ऐप में दोबारा लॉगिन करें। आपका काम सुरक्षित रहेगा।"
        : "Please re-login. Your completed work remains safe.",
    };
  }

  if (/wrong technician|different staff member|not assigned to you/i.test(lower)) {
    return {
      title: isHindi ? "काम दूसरे साथी को सौंपा गया है" : "Job Reassigned",
      description: isHindi
        ? "यह काम अब आपके नाम पर नहीं है। लिस्ट रीफ्रेश हो रही है।"
        : "This job is no longer assigned to you. The list is updating.",
    };
  }

  if (/assignment.*removed|linked assignment was removed/i.test(lower)) {
    return {
      title: isHindi ? "काम हटा दिया गया है" : "Assignment Removed",
      description: isHindi
        ? "एडमिन ने इस काम का असाइनमेंट हटा दिया है।"
        : "This assignment was removed by admin.",
    };
  }

  if (/cancelled|execution is already cancelled/i.test(lower)) {
    return {
      title: isHindi ? "काम रद्द हो चुका है" : "Job Cancelled",
      description: isHindi
        ? "एडमिन या कस्टमर ने यह काम रद्द कर दिया है।"
        : "This job was cancelled by admin or customer.",
    };
  }

  if (/terminal status|cannot transition.*terminal|cannot confirm.*terminal|cannot cancel a completed/i.test(lower)) {
    return {
      title: isHindi ? "काम पहले ही पूरा या रद्द हो चुका है" : "Job Closed",
      description: isHindi
        ? "यह काम सर्वर पर बंद हो चुका है और बदला नहीं जा सकता।"
        : "This job is in a terminal state and cannot be changed.",
    };
  }

  if (/already completed|already started/i.test(lower)) {
    return {
      title: isHindi ? "स्थिति पहले ही अपडेट है" : "Status Already Updated",
      description: isHindi
        ? "यह काम सर्वर पर पहले ही अपडेट हो चुका है।"
        : "This action has already been confirmed by the server.",
    };
  }

  return {
    title: isHindi ? "काम सेव नहीं हुआ" : "Action Incomplete",
    description: isHindi
      ? "कृपया दोबारा कोशिश करें। यदि समस्या बनी रहे तो सुपरवाइजर से संपर्क करें।"
      : "Please try again or contact your field supervisor if this continues.",
  };
}

export function translate(key: TranslationKey, lang: StaffLanguage = currentLang): string {
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}
