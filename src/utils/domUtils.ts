/**
 * DOM Utility functions for QuickFill V2
 */

import type { FormElement } from "../types";
import { INPUT_SELECTORS, FILLED_FIELD_STYLE } from "./constants";

// Internal map to keep track of elements by UUID
const elementMap = new Map<string, HTMLElement>();

/**
 * Finds all elements that match a selector, ignoring aria-hidden status
 * @param selector CSS selector to match
 * @param root Root element to start search from
 * @returns Array of matching elements
 */
const findAllElements = (
  selector: string,
  root: Element | Document,
): Element[] => {
  // First, get elements matched by regular selector
  const directMatches = Array.from(root.querySelectorAll(selector));

  // Get all elements in the document (including hidden ones)
  const allElements = Array.from(root.querySelectorAll("*"));

  // Filter to just the ones that match our selector via matches()
  // This will include elements hidden by aria-hidden
  const allMatches = allElements.filter((el) => {
    try {
      return el.matches(selector);
    } catch (e) {
      return false;
    }
  });

  // Remove duplicates by creating a Set
  return [...new Set([...directMatches, ...allMatches])];
};

/**
 * Indexes all input elements on the page with UUIDs, including hidden elements
 * @returns Array of elements with UUID indexes and attributes string
 */
export const indexAllInputs = (): FormElement[] => {
  // Check if document is defined (only works in content script, not background)
  if (typeof document === "undefined") {
    console.error(
      "indexAllInputs called in context where document is not available",
    );
    return [];
  }

  // Clear previous element map
  elementMap.clear();

  // Get all input elements matching our selectors
  const selectorString = INPUT_SELECTORS.join(", ");

  // Find all interactive elements, even those in aria-hidden containers or with pointer-events: none
  const elements = findAllElements(selectorString, document);

  // Special case for dialogs and modals - ensure we always check them
  const modalElements = findAllElements(
    '[role="dialog"], .modal, .dialog, [aria-modal="true"]',
    document,
  );
  const modalInputs: Element[] = [];

  // Find inputs within modals
  for (const modal of modalElements) {
    for (const selector of INPUT_SELECTORS) {
      const inputs = findAllElements(selector, modal);
      modalInputs.push(...inputs);
    }
  }

  // Also get inputs within forms
  const forms = findAllElements("form", document);
  const formInputsMap = new Map<Element, string>();

  // Process form elements and track form IDs
  for (const form of forms) {
    const formId = form.id || `form-${crypto.randomUUID().slice(0, 8)}`;

    // Find inputs in this form
    const formInputs: Element[] = [];
    for (const selector of INPUT_SELECTORS) {
      const inputs = findAllElements(selector, form);
      formInputs.push(...inputs);
    }

    for (const input of formInputs) {
      formInputsMap.set(input, formId);
    }
  }

  // Combine all elements (deduplicate with Set)
  const allElements = [...new Set([...elements, ...modalInputs])];

  return allElements.map((element) => {
    // Generate a UUID for this element
    const uuid = crypto.randomUUID();

    // Save reference to the element in our map
    elementMap.set(uuid, element as HTMLElement);

    const el = element as HTMLElement;

    // Create attribute string from all element attributes
    let attributesString = "";
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      // Skip data attributes and style
      if (attr.name !== "style") {
        attributesString += `${attr.name}="${attr.value}" `;
      }
    }

    // Add label text if available
    const labelText = getElementLabel(el);
    if (labelText) {
      attributesString += `label="${labelText}" `;
    }

    // Add form ID if the element is part of a form
    if (formInputsMap.has(element)) {
      attributesString += `formId="${formInputsMap.get(element)}" `;
    } else if (el.closest("form")) {
      const parentForm = el.closest("form");
      const formId =
        parentForm?.id || `form-${crypto.randomUUID().slice(0, 8)}`;
      attributesString += `formId="${formId}" `;
    }

    // Add info about modal/dialog container if present
    const dialogParent = el.closest(
      '[role="dialog"], .modal, .dialog, [aria-modal="true"]',
    );
    if (dialogParent) {
      attributesString += `inDialog="true" `;
    }

    // Create a FormElement with UUID and attributes string
    return {
      idx: uuid,
      otherAttributesMap: attributesString.trim(),
    };
  });
};

/**
 * Get the label text for an input element
 * @param element The input element
 * @returns Label text or empty string
 */
const getElementLabel = (element: HTMLElement): string => {
  // Check for parent label
  const parentLabel = element.closest("label");
  if (parentLabel?.textContent) {
    return parentLabel.textContent.trim();
  }

  // Check for preceding label or span
  let sibling = element.previousElementSibling;
  while (sibling) {
    if (
      (sibling.tagName === "LABEL" || sibling.tagName === "SPAN") &&
      sibling.textContent
    ) {
      return sibling.textContent.trim();
    }
    sibling = sibling.previousElementSibling;
  }

  return "";
};

/**
 * Fills a form element with a value using its UUID
 * @param idx UUID of the input element
 * @param value Value to fill
 * @returns Boolean indicating success
 */
export const fillInputByIdx = (idx: string, value: string): boolean => {
  // Get the element from our map
  const element = elementMap.get(idx);

  if (!element) {
    console.error("Element with UUID not found:", idx);
    return false;
  }

  try {
    // Check if element is in a dialog with pointer-events restrictions
    const dialogParent = element.closest('[role="dialog"]');
    if (dialogParent) {
      // Force pointer-events auto temporarily if needed
      const originalStyle = dialogParent.getAttribute("style") || "";
      if (originalStyle.includes("pointer-events: none")) {
        dialogParent.setAttribute(
          "style",
          originalStyle.replace("pointer-events: none", "pointer-events: auto"),
        );
        // Restore after filling
        setTimeout(() => {
          dialogParent.setAttribute("style", originalStyle);
        }, 100);
      }
    }

    if (element.tagName === "SELECT") {
      // Handle select elements
      const selectElement = element as HTMLSelectElement;
      const options = Array.from(selectElement.options);

      // Try to find a matching option
      const matchingOption = options.find((option) => {
        const optionText = option.text.toLowerCase();
        const valueText = value.toLowerCase();
        return optionText.includes(valueText) || valueText.includes(optionText);
      });

      if (matchingOption) {
        selectElement.value = matchingOption.value;
        selectElement.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        return false;
      }
    } else {
      // Handle input and textarea elements
      const inputElement = element as HTMLInputElement | HTMLTextAreaElement;
      inputElement.value = value;
      inputElement.dispatchEvent(new Event("input", { bubbles: true }));
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // Apply highlighting style to indicate the field was filled
    applyFilledStyle(element);

    return true;
  } catch (error) {
    console.error("Error filling element:", error);
    return false;
  }
};

/**
 * Applies style to indicate a field was filled
 * @param element Element to style
 */
const applyFilledStyle = (element: HTMLElement): void => {
  // Save original styles to restore later
  const originalStyle = element.getAttribute("style") || "";
  element.setAttribute("data-quickfill-original-style", originalStyle);

  // Apply new style
  element.setAttribute("style", `${originalStyle} ${FILLED_FIELD_STYLE}`);

  // Remove highlight after 3 seconds
  setTimeout(() => {
    const original = element.getAttribute("data-quickfill-original-style");
    if (original !== null) {
      element.setAttribute("style", original);
      element.removeAttribute("data-quickfill-original-style");
    }
  }, 3000);
};
