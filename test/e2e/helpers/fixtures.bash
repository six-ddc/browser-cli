#!/usr/bin/env bash
# helpers/fixtures.bash — Test URL constants and fixture data for E2E tests
#
# All test URLs point to https://the-internet.herokuapp.com/ which provides
# a stable set of pages covering common web interaction patterns.

# Base URL
export BASE_URL="https://the-internet.herokuapp.com"

# Page URLs — organized by test category
export URL_HOME="${BASE_URL}/"
export URL_LOGIN="${BASE_URL}/login"
export URL_SECURE="${BASE_URL}/secure"
export URL_CHECKBOXES="${BASE_URL}/checkboxes"
export URL_DROPDOWN="${BASE_URL}/dropdown"
export URL_INPUTS="${BASE_URL}/inputs"
export URL_UPLOAD="${BASE_URL}/upload"
export URL_DRAG_AND_DROP="${BASE_URL}/drag_and_drop"
export URL_HOVERS="${BASE_URL}/hovers"
export URL_KEY_PRESSES="${BASE_URL}/key_presses"
export URL_CONTEXT_MENU="${BASE_URL}/context_menu"
export URL_ADD_REMOVE="${BASE_URL}/add_remove_elements/"
export URL_DYNAMIC_CONTENT="${BASE_URL}/dynamic_content"
export URL_DYNAMIC_CONTROLS="${BASE_URL}/dynamic_controls"
export URL_DYNAMIC_LOADING_1="${BASE_URL}/dynamic_loading/1"
export URL_DYNAMIC_LOADING_2="${BASE_URL}/dynamic_loading/2"
export URL_IFRAME="${BASE_URL}/iframe"
export URL_NESTED_FRAMES="${BASE_URL}/nested_frames"
export URL_FRAMES="${BASE_URL}/frames"
export URL_JAVASCRIPT_ALERTS="${BASE_URL}/javascript_alerts"
export URL_JAVASCRIPT_ERROR="${BASE_URL}/javascript_error"
export URL_LARGE_PAGE="${BASE_URL}/large"
export URL_INFINITE_SCROLL="${BASE_URL}/infinite_scroll"
export URL_GEOLOCATION="${BASE_URL}/geolocation"
export URL_FORGOT_PASSWORD="${BASE_URL}/forgot_password"
export URL_ABTEST="${BASE_URL}/abtest"
export URL_BROKEN_IMAGES="${BASE_URL}/broken_images"
export URL_CHALLENGING_DOM="${BASE_URL}/challenging_dom"
export URL_DISAPPEARING_ELEMENTS="${BASE_URL}/disappearing_elements"
export URL_ENTRY_AD="${BASE_URL}/entry_ad"
export URL_EXIT_INTENT="${BASE_URL}/exit_intent"
export URL_FLOATING_MENU="${BASE_URL}/floating_menu"
export URL_HORIZONTAL_SLIDER="${BASE_URL}/horizontal_slider"
export URL_JQUERY_UI_MENUS="${BASE_URL}/jqueryui/menu"
export URL_NOTIFICATION="${BASE_URL}/notification_message_rendered"
export URL_REDIRECT="${BASE_URL}/redirector"
export URL_SHADOW_DOM="${BASE_URL}/shadowdom"
export URL_SHIFTING_CONTENT="${BASE_URL}/shifting_content"
export URL_SORTABLE_DATA_TABLES="${BASE_URL}/tables"
export URL_STATUS_CODES="${BASE_URL}/status_codes"
export URL_TYPOS="${BASE_URL}/typos"
export URL_WINDOWS="${BASE_URL}/windows"

# Test credentials for login page
export TEST_USERNAME="tomsmith"
export TEST_PASSWORD="SuperSecretPassword!"

# Common selectors reused across tests
export SEL_CHECKBOX='input[type="checkbox"]'
export SEL_DROPDOWN="select#dropdown"
export SEL_USERNAME="#username"
export SEL_PASSWORD="#password"
export SEL_LOGIN_BTN='button[type="submit"]'
export SEL_FLASH_MESSAGE="#flash"
export SEL_FILE_UPLOAD="#file-upload"
export SEL_FILE_SUBMIT="#file-submit"
export SEL_DRAG_COL_A="#column-a"
export SEL_DRAG_COL_B="#column-b"
