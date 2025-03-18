# QuickFill V2 - "Fill Forms" Method Call Sequence

When a user clicks the "Fill Forms" button in the QuickFill V2 extension, the following sequence of method calls occurs:

1. User clicks "Fill Forms" button in popup (App.tsx)
2. `fillForms()` function is called in App.tsx
3. Message sent to background script with action FILL_FORMS
4. Background script's `handleFillForms()` processes the request
5. Background requests form data from content script via `requestFormData()`
6. Content script's `handleGetFormData()` calls `indexAllInputs()`
7. Content script returns indexed form elements to background
8. Background script gets user context data
9. Background calls `processFormWithGPT()` with form elements and context
10. GPT API processes the request and returns field mappings
11. Background sends mappings to content script via `fillFormFields()`
12. Content script's `handleFillForms()` uses `fillInputByIdx()` for each field
13. Content script highlights filled fields and shows notification
14. Background script logs the action and returns results to popup
15. Popup updates UI and shows logs