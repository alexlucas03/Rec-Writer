import { queryService } from './queryService';
import { dbStorage } from '../utils/indexedDBStorage';
import { writingSampleAnalyzer, AnalysisCategories } from './writingSampleAnalyzer';

interface StudentInfo {
  studentName: string;
  schoolProgram: string;
  course: string;
  customCourse?: string;
  whenTaught: string;
  academicStrength: string;
  characterWords: string[];
  academicAnecdote: string;
  characterAnecdote: string;
}

class ContentGenerator {
  private readonly DEFAULT_MODEL = 'gemma3';
  
  /**
   * Generates a recommendation letter using the teacher's writing samples and student notes
   */
  async generateContent(teacherName: string, studentInfoJSON: string): Promise<string> {
    try {
      // Parse student info
      const studentInfo: StudentInfo = JSON.parse(studentInfoJSON);
      
      // 1. Get a random writing sample to use as a template
      const templateSample = await this.getRandomWritingSample(teacherName);
      if (!templateSample) {
        throw new Error("No writing samples found for template");
      }
      
      // 2. Get all categorized sentences from localStorage
      const categorizedSentences = writingSampleAnalyzer.getCategories(teacherName);
      
      // 3. Extract common opening and closing patterns from all samples
      const { openingSentences, closingSentences } = await this.extractCommonPatterns(teacherName);
      
      // 4. Categorize each sentence in the template sample
      const templateStructure = await this.categorizeTemplate(templateSample.content);
      
      // 5. Generate a new letter by replacing each sentence in the template with a random sentence from the same category
      // While preserving the opening and closing sentences
      const generatedContent = await this.generateLetter(
        templateStructure, 
        categorizedSentences,
        studentInfo,
        teacherName,
        openingSentences,
        closingSentences
      );
      
      return generatedContent;
    } catch (error) {
      console.error('Error generating content:', error);
      throw error;
    }
  }
  
  /**
   * Gets a random writing sample for the given teacher
   */
  private async getRandomWritingSample(teacherName: string): Promise<any | null> {
    const samples = await dbStorage.getTeacherWritingSamples(teacherName);
    
    if (samples.length === 0) {
      return null;
    }
    
    // Pick a random sample
    const randomIndex = Math.floor(Math.random() * samples.length);
    return samples[randomIndex];
  }
  
/**
 * Extracts common opening and closing patterns from all writing samples by
 * working inward from both ends until the patterns diverge
 */
private async extractCommonPatterns(teacherName: string): Promise<{
    openingSentences: string[];
    closingSentences: string[];
  }> {
    const samples = await dbStorage.getTeacherWritingSamples(teacherName);
    
    if (samples.length < 2) {
      // Need at least 2 samples to compare patterns
      return {
        openingSentences: samples.length === 1 && samples[0].content ? 
          [samples[0].content.match(/[^.!?]+[.!?]+/g)?.[0]?.trim() || ''] : [],
        closingSentences: samples.length === 1 && samples[0].content ?
          [samples[0].content.match(/[^.!?]+[.!?]+/g)?.pop()?.trim() || ''] : []
      };
    }
    
    // Parse all samples into sentence arrays
    const sampleSentences: string[][] = [];
    let maxOpeningPatternLength = 0;
    
    for (const sample of samples) {
      if (!sample.content) continue;
      
      const sentences = sample.content.match(/[^.!?]+[.!?]+/g) || [];
      if (sentences.length > 0) {
        sampleSentences.push(sentences.map(s => s.trim()));
        // Track the max possible opening pattern length (half the shortest sample)
        maxOpeningPatternLength = maxOpeningPatternLength === 0 ? 
          Math.floor(sentences.length / 2) : 
          Math.min(maxOpeningPatternLength, Math.floor(sentences.length / 2));
      }
    }
    
    if (sampleSentences.length < 2) {
      return {
        openingSentences: [],
        closingSentences: []
      };
    }
    
    // Find common opening pattern by comparing sentences
    const openingSentences: string[] = [];
    
    // Compare each position across all samples
    for (let position = 0; position < maxOpeningPatternLength; position++) {
      // Get all sentences at this position from each sample
      const sentencesAtPosition = sampleSentences.map(sentences => sentences[position]);
      
      // Calculate similarity between sentences
      if (this.areSentencesSimilar(sentencesAtPosition)) {
        // If sentences are similar enough, add to pattern
        openingSentences.push(sentencesAtPosition[0]);
      } else {
        // Pattern breaks, stop looking
        break;
      }
    }
    
    // Find common closing pattern by comparing sentences from the end
    const closingSentences: string[] = [];
    
    // Compare each position from the end across all samples
    for (let posFromEnd = 1; posFromEnd <= maxOpeningPatternLength; posFromEnd++) {
      // Get all sentences at this position from the end of each sample
      const sentencesAtPosition = sampleSentences.map(sentences => 
        sentences[sentences.length - posFromEnd]
      );
      
      // Calculate similarity between sentences
      if (this.areSentencesSimilar(sentencesAtPosition)) {
        // If sentences are similar enough, add to pattern (prepend to maintain order)
        closingSentences.unshift(sentencesAtPosition[0]);
      } else {
        // Pattern breaks, stop looking
        break;
      }
    }
    
    console.log("Extracted opening pattern:", openingSentences);
    console.log("Extracted closing pattern:", closingSentences);
    
    return {
      openingSentences,
      closingSentences
    };
  }
  
  /**
   * Determines if a set of sentences are similar enough to be considered a pattern
   * Using a combination of sentence length similarity and word overlap
   */
  private areSentencesSimilar(sentences: string[]): boolean {
    if (sentences.length < 2) return true;
    if (sentences.some(s => !s)) return false;
    
    // Remove sentences that are too different in length
    const lengths = sentences.map(s => s.length);
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    
    const filteredSentences = sentences.filter(s => {
      const lenRatio = s.length / avgLength;
      return lenRatio >= 0.7 && lenRatio <= 1.3; // Within 30% of average length
    });
    
    if (filteredSentences.length < sentences.length * 0.7) {
      // If too many sentences were filtered out, they're not similar
      return false;
    }
    
    // Check word overlap
    const tokenizeSentence = (s: string) => 
      s.toLowerCase()
       .replace(/[.,?!;:()"']/g, '')
       .split(/\s+/)
       .filter(w => w.length > 3); // Only meaningful words
    
    const wordArrays = filteredSentences.map(s => tokenizeSentence(s));
    
    // Calculate Jaccard similarity between all pairs using arrays instead of sets
    let totalSimilarity = 0;
    let pairCount = 0;
    
    for (let i = 0; i < wordArrays.length; i++) {
      for (let j = i + 1; j < wordArrays.length; j++) {
        // Calculate intersection size (ES5 compatible)
        const intersection = wordArrays[i].filter(word => 
          wordArrays[j].indexOf(word) !== -1
        );
        
        // Calculate union size (ES5 compatible)
        const uniqueWords: {[key: string]: boolean} = {};
        wordArrays[i].concat(wordArrays[j]).forEach(word => {
          uniqueWords[word] = true;
        });
        const unionSize = Object.keys(uniqueWords).length;
        
        const similarity = unionSize > 0 ? intersection.length / unionSize : 0;
        totalSimilarity += similarity;
        pairCount++;
      }
    }
    
    const avgSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0;
    
    // Check for key phrase patterns that indicate opening/closing
    const openingPhrases = [
      "i am writing", "it is with", "i am pleased", "i am delighted", 
      "i am happy", "i have known", "this letter", "to whom"
    ];
    
    const closingPhrases = [
      "if you have", "please feel", "please do not", "i would be", 
      "i can be", "i am available", "sincerely", "do not hesitate",
      "i highly recommend", "i recommend", "i endorse", "without reservation"
    ];
    
    const isOpeningOrClosing = filteredSentences.some(s => {
      const lower = s.toLowerCase();
      return openingPhrases.some(phrase => lower.indexOf(phrase) !== -1) || 
             closingPhrases.some(phrase => lower.indexOf(phrase) !== -1);
    });
    
    // Consider sentences similar if they have high word overlap OR contain key phrases
    return avgSimilarity >= 0.3 || isOpeningOrClosing;
  }
  
  /**
   * Categorizes each sentence in the template and returns the structure
   */
  private async categorizeTemplate(templateContent: string): Promise<{
    category: string;
    originalSentence: string;
    position: 'opening' | 'middle' | 'closing';
  }[]> {
    // Ensure templateContent is not undefined or null
    if (!templateContent) {
      return [];
    }
    
    // First, split the template into sentences (naive approach, improve as needed)
    const sentences = templateContent.match(/[^.!?]+[.!?]+/g) || [];
    
    if (sentences.length === 0) {
      return [];
    }
    
    // Create a prompt to categorize each sentence
    const prompt = `
Categorize each of the following sentences from a teacher's recommendation letter into one of these categories:
- introduction_context (sentences that introduce the student or provide background)
- endorsement (sentences that directly support/endorse the student)
- commentary (sentences that offer opinions or observations)
- qualities (sentences that highlight specific skills or attributes)
- further_discussion (sentences inviting follow-up or providing contact information)

For each sentence, respond ONLY with the category name. Provide your answers as a JSON array of strings, with each element being just the category name.

Sentences to categorize:
${sentences.map((s, i) => `${i+1}. ${s.trim()}`).join('\n')}
`;

    // Send the prompt to the LLM
    const response = await queryService.generateText({
      model: this.DEFAULT_MODEL,
      prompt: prompt,
      options: {
        temperature: 0.3,
        top_p: 0.9,
        max_tokens: 1000,
      },
    });
    
    // Extract the categorization from the response
    let categories: string[] = [];
    try {
      // Try to parse as JSON first
      const responseText = response.text || '';
      // Fixed: Use regex without the 's' flag which requires ES2018+
      const jsonMatch = responseText.match(/\[([\s\S]*)\]/);
      
      if (jsonMatch && jsonMatch[0]) {
        try {
          categories = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('JSON parse error:', e);
          categories = [];
        }
      } else {
        // Fallback: extract categories line by line
        categories = responseText
          .split('\n')
          .filter(line => line.trim().length > 0)
          .map(line => {
            const category = line.replace(/^\d+\.\s*/, '').trim(); // Remove any numbering
            return this.validateCategory(category);
          });
      }
    } catch (error) {
      console.error('Error parsing categories:', error);
      // Fallback: assign default categories based on position in the letter
      categories = sentences.map((_, index) => {
        const position = index / sentences.length;
        if (position < 0.2) return 'introduction_context';
        if (position < 0.4) return 'qualities';
        if (position < 0.7) return 'endorsement';
        if (position < 0.9) return 'commentary';
        return 'further_discussion';
      });
    }

    console.log("categories: " + categories);
    
    // Ensure we have the right number of categories
    if (categories.length !== sentences.length) {
      // Pad or truncate as needed
      while (categories.length < sentences.length) {
        categories.push('commentary'); // Default category
      }
      categories = categories.slice(0, sentences.length);
    }
    
    // Combine sentences with their categories and mark position
    return sentences.map((sentence, index) => {
      let position: 'opening' | 'middle' | 'closing' = 'middle';
      
      // Mark first sentence as opening
      if (index === 0) {
        position = 'opening';
      } 
      // Mark last 1-2 sentences as closing (depending on length)
      else if (sentences.length >= 3 && index >= sentences.length - 2) {
        position = 'closing';
      } else if (sentences.length < 3 && index === sentences.length - 1) {
        position = 'closing';
      }
      
      return {
        category: categories[index] || 'commentary', // Provide default if undefined
        originalSentence: sentence.trim(),
        position
      };
    });
  }
  
  /**
   * Validates and normalizes a category name
   */
  private validateCategory(category: string): string {
    // Handle potential undefined or null values
    if (!category) return 'commentary';
    
    const normalizedCategory = category.toLowerCase().trim();
    
    // Map variations to our standard categories
    if (normalizedCategory.includes('introduction') || normalizedCategory.includes('context')) {
      return 'introduction_context';
    } else if (normalizedCategory.includes('endorse')) {
      return 'endorsement';
    } else if (normalizedCategory.includes('comment')) {
      return 'commentary';
    } else if (normalizedCategory.includes('quality') || normalizedCategory.includes('qualities')) {
      return 'qualities';
    } else if (normalizedCategory.includes('further') || normalizedCategory.includes('discussion')) {
      return 'further_discussion';
    }
    
    // Default
    return 'commentary';
  }
  
  /**
   * Generates a letter by replacing template sentences with random sentences from the same category
   * and personalizing them to the student, while preserving opening and closing patterns
   */
  private async generateLetter(
    templateStructure: {category: string, originalSentence: string, position: 'opening' | 'middle' | 'closing'}[],
    categorizedSentences: AnalysisCategories,
    studentInfo: StudentInfo,
    teacherName: string,
    openingSentences: string[],
    closingSentences: string[]
  ): Promise<string> {
    // If template structure is empty, return a fallback message
    if (templateStructure.length === 0) {
      return `I couldn't generate a recommendation letter due to insufficient template structure. Please ensure there are enough writing samples with complete sentences.`;
    }
    
    // 1. Replace each sentence in the template with a random sentence from the same category
    // But preserve opening and closing patterns
    const replacedStructure = templateStructure.map(item => {
      // For opening sentences, use a random opening from the collection
      if (item.position === 'opening' && openingSentences.length > 0) {
        const randomOpeningIndex = Math.floor(Math.random() * openingSentences.length);
        return {
          ...item,
          replacementSentence: openingSentences[randomOpeningIndex]
        };
      }
      
      // For closing sentences, use a random closing from the collection
      if (item.position === 'closing' && closingSentences.length > 0) {
        const randomClosingIndex = Math.floor(Math.random() * closingSentences.length);
        return {
          ...item,
          replacementSentence: closingSentences[randomClosingIndex]
        };
      }
      
      // For middle sentences, use a random sentence from the same category
      const category = item.category as keyof AnalysisCategories;
      const sentencesInCategory = categorizedSentences[category] || [];
      
      if (sentencesInCategory.length === 0) {
        // If no sentences in this category, keep the original
        return { ...item, replacementSentence: item.originalSentence };
      }
      
      // Pick a random sentence from this category
      const randomIndex = Math.floor(Math.random() * sentencesInCategory.length);
      return {
        ...item,
        replacementSentence: sentencesInCategory[randomIndex]
      };
    });
    
    // 2. Combine the sentences into a draft letter
    const draftLetter = replacedStructure
      .map(item => item.replacementSentence || item.originalSentence) // Fallback to original if replacement is undefined
      .join(' ');

    console.log("Draft: " + draftLetter);
    
    // 3. Personalize the letter to the student
    const personalizedLetter = await this.personalizeLetter(draftLetter, studentInfo, teacherName);
    
    return personalizedLetter;
  }
  
  /**
   * Personalizes the letter to the specific student by modifying individual words
   * and incorporating the student's anecdotes
   */
  private async personalizeLetter(
    draftLetter: string,
    studentInfo: StudentInfo,
    teacherName: string
  ): Promise<string> {
    // Create a prompt for the LLM to personalize the letter
    const prompt = `
You are helping a teacher named ${teacherName} write a recommendation letter for a student applying to a college/university program.

I'll provide you with:
1. A draft recommendation letter created from pieces of previous letters
2. Information about the specific student

Your task is to personalize the letter to the student by:
1. Replacing ONLY words (names, pronouns, subjects, etc.) to match the student. You can replace as many words as you want, since we aren't trying to repeat what we have written for prior students.
2. The only exception to point 1 is when incorporating the student's academic and character anecdotes. Integrate them into the paper while trying to precisely match the writing style of the rest of the letter.
3. Ensuring the letter flows naturally and is addressed to the correct program/school
4. DO NOT change sentence structures except when incorporating the anecdotes

STUDENT INFORMATION:
- Name: ${studentInfo.studentName}
- Applying to: ${studentInfo.schoolProgram}
- Course taken: ${studentInfo.customCourse || studentInfo.course}
- When taken: ${studentInfo.whenTaught}
- Academic strength: ${studentInfo.academicStrength}
- Character described as: ${studentInfo.characterWords.join(', ')}
- Academic anecdote: ${studentInfo.academicAnecdote}
- Character anecdote: ${studentInfo.characterAnecdote}

DRAFT LETTER:
${draftLetter}

Please provide the personalized letter that maintains the teacher's writing style but is tailored to this specific student.
`;

    // Send the prompt to the LLM
    const response = await queryService.generateText({
      model: this.DEFAULT_MODEL,
      prompt: prompt,
      options: {
        temperature: 0.7, // Higher temperature for more creativity in personalization
        top_p: 0.9,
        max_tokens: 2000,
      },
    });
    
    return response.text || "Unable to generate personalized content. Please try again.";
  }
}

export const contentGenerator = new ContentGenerator();