/**
 * DOM Utility functions for QuickFill V2
 */

import { FormElement } from '../types';
import { INPUT_SELECTORS, FILLED_FIELD_STYLE } from './constants';

// Internal map to keep track of elements by UUID
const elementMap = new Map<string, HTMLElement>();

/**
 * Indexes all input elements on the page with UUIDs
 * @returns Array of elements with UUID indexes only
 */
export const indexAllInputs = (): FormElement[] => {
  // Clear previous element map
  elementMap.clear();
  
  // Get all input elements matching our selectors
  const selectorString = INPUT_SELECTORS.join(', ');
  const elements = Array.from(document.querySelectorAll(selectorString));
  
  return elements.map((element) => {
    // Generate a UUID for this element
    const uuid = crypto.randomUUID();
    
    // Save reference to the element in our map
    elementMap.set(uuid, element as HTMLElement);
    
    // Create a basic object with just the UUID
    return {
      idx: uuid
    };
  });
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
    console.error('Element with UUID not found:', idx);
    return false;
  }
  
  try {
    if (element.tagName === 'SELECT') {
      // Handle select elements
      const selectElement = element as HTMLSelectElement;
      const options = Array.from(selectElement.options);
      
      // Try to find a matching option
      const matchingOption = options.find(option => {
        const optionText = option.text.toLowerCase();
        const valueText = value.toLowerCase();
        return optionText.includes(valueText) || valueText.includes(optionText);
      });
      
      if (matchingOption) {
        selectElement.value = matchingOption.value;
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        return false;
      }
    } else {
      // Handle input and textarea elements
      const inputElement = element as HTMLInputElement | HTMLTextAreaElement;
      inputElement.value = value;
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Apply highlighting style to indicate the field was filled
    applyFilledStyle(element);
    
    return true;
  } catch (error) {
    console.error('Error filling element:', error);
    return false;
  }
};

/**
 * Applies style to indicate a field was filled
 * @param element Element to style
 */
const applyFilledStyle = (element: HTMLElement): void => {
  // Save original styles to restore later
  const originalStyle = element.getAttribute('style') || '';
  element.setAttribute('data-quickfill-original-style', originalStyle);
  
  // Apply new style
  element.setAttribute('style', `${originalStyle} ${FILLED_FIELD_STYLE}`);
  
  // Remove highlight after 3 seconds
  setTimeout(() => {
    const original = element.getAttribute('data-quickfill-original-style');
    if (original !== null) {
      element.setAttribute('style', original);
      element.removeAttribute('data-quickfill-original-style');
    }
  }, 3000);
};