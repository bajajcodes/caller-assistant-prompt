function isValidCallSid(str: string): boolean {
  // Regex for Call SID format: "CA" followed by 32 alphanumeric characters
  const callSidRegex = /^CA[a-zA-Z0-9]{32}$/;

  // Basic regex check
  if (!callSidRegex.test(str)) {
    return false;
  }

  return true;
}

export { isValidCallSid };
