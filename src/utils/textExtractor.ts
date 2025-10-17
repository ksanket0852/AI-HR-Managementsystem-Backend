import fs from 'fs';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import path from 'path';

export interface ExtractedText {
  text: string;
  pages?: number;
  error?: string;
}

/**
 * Extract text from PDF files
 */
export const extractTextFromPDF = async (filePath: string): Promise<ExtractedText> => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    
    return {
      text: data.text.trim(),
      pages: data.numpages
    };
  } catch (error) {
    console.error('PDF text extraction error:', error);
    return {
      text: '',
      error: `Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Extract text from DOC files
 */
export const extractTextFromDOC = async (filePath: string): Promise<ExtractedText> => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer: dataBuffer });
    
    return {
      text: result.value.trim()
    };
  } catch (error) {
    console.error('DOC text extraction error:', error);
    return {
      text: '',
      error: `Failed to extract text from DOC: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Extract text from DOCX files
 */
export const extractTextFromDOCX = async (filePath: string): Promise<ExtractedText> => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer: dataBuffer });
    
    return {
      text: result.value.trim()
    };
  } catch (error) {
    console.error('DOCX text extraction error:', error);
    return {
      text: '',
      error: `Failed to extract text from DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Main text extraction function that handles different file types
 */
export const extractTextFromFile = async (filePath: string): Promise<ExtractedText> => {
  const fileExtension = path.extname(filePath).toLowerCase();
  
  switch (fileExtension) {
    case '.pdf':
      return await extractTextFromPDF(filePath);
    case '.doc':
      return await extractTextFromDOC(filePath);
    case '.docx':
      return await extractTextFromDOCX(filePath);
    default:
      return {
        text: '',
        error: `Unsupported file type: ${fileExtension}`
      };
  }
};

/**
 * Clean and normalize extracted text
 */
export const cleanExtractedText = (text: string): string => {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove special characters but keep necessary punctuation
    .replace(/[^\w\s.,@()-]/g, ' ')
    // Trim whitespace
    .trim();
};

/**
 * Validate extracted text quality
 */
export const validateExtractedText = (text: string): boolean => {
  // Check if text has minimum length
  if (text.length < 50) {
    return false;
  }
  
  // Check if text contains common resume keywords
  const commonKeywords = [
    'experience', 'education', 'skill', 'work', 'job', 'company', 
    'university', 'college', 'degree', 'email', 'phone', 'name'
  ];
  
  const lowerText = text.toLowerCase();
  const foundKeywords = commonKeywords.filter(keyword => lowerText.includes(keyword));
  
  return foundKeywords.length >= 2;
}; 