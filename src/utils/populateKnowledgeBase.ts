import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

// Initialize OpenAI and Pinecone clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

const indexName = 'hr-knowledge-base';

// Sample HR policies to populate the knowledge base
const hrPolicies = [
  {
    title: 'Vacation Policy',
    content: 'Employees are entitled to 20 days of paid vacation per year. Vacation days must be requested at least 2 weeks in advance through the HRMS system. Unused vacation days can be carried over to the next year, up to a maximum of 5 days. Employees must take at least 10 vacation days per year for wellbeing purposes.'
  },
  {
    title: 'Sick Leave',
    content: 'Employees can take up to 10 paid sick days per year. For absences longer than 3 consecutive days, a doctor\'s note is required. Sick leave does not carry over to the next year. Employees should notify their manager as soon as possible when taking sick leave.'
  },
  {
    title: 'Remote Work',
    content: 'Employees can work remotely up to 2 days per week with manager approval. Remote work requests must be submitted through the HRMS system at least 24 hours in advance. Employees are expected to be available during regular working hours and maintain the same level of productivity when working remotely.'
  },
  {
    title: 'Parental Leave',
    content: 'New parents are entitled to 12 weeks of paid leave. This applies to birth, adoption, or foster care placement. Employees must notify HR at least 30 days in advance when possible. The leave can be taken continuously or intermittently within the first year after the child\'s arrival.'
  },
  {
    title: 'Healthcare Benefits',
    content: 'The company provides comprehensive health insurance to all full-time employees. Coverage includes medical, dental, and vision plans. Employees can add dependents to their plan. The open enrollment period is in November each year, with coverage beginning January 1.'
  },
  {
    title: 'Professional Development',
    content: 'Employees are eligible for up to $2,000 per year for professional development activities. This includes conferences, workshops, courses, and certifications relevant to their role. Requests must be approved by the manager and HR department.'
  },
  {
    title: 'Performance Reviews',
    content: 'Performance reviews are conducted twice a year, in June and December. Reviews include self-assessment, manager assessment, and peer feedback. Goals are set during each review cycle and progress is tracked through the HRMS system.'
  },
  {
    title: 'Overtime Policy',
    content: 'Non-exempt employees are eligible for overtime pay at 1.5 times their regular hourly rate for hours worked over 40 in a workweek. All overtime must be approved in advance by the manager. Exempt employees are not eligible for overtime pay.'
  },
  {
    title: 'Travel Policy',
    content: 'Business travel expenses are reimbursed when submitted with receipts through the expense management system within 30 days of travel. Eligible expenses include transportation, lodging, meals, and other necessary business expenses.'
  },
  {
    title: 'Code of Conduct',
    content: 'Employees are expected to maintain high ethical standards, treat others with respect, and comply with all company policies. Harassment, discrimination, and retaliation are not tolerated. Violations should be reported to HR immediately.'
  }
];

/**
 * Generate embeddings for a text using OpenAI
 */
async function generateEmbeddings(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });

  return response.data[0].embedding;
}

/**
 * Create a Pinecone index with integrated embedding
 */
async function createIndex() {
  try {
    // Check if index exists
    const indexList = await pinecone.listIndexes();
    const indexes = indexList.indexes || [];
    
    if (!indexes.some(idx => idx.name === indexName)) {
      console.log(`Creating index: ${indexName}`);
      
      // Create an index with integrated embedding
      await pinecone.createIndexForModel({
        name: indexName,
        cloud: 'aws',
        region: 'us-east-1',
        embed: {
          model: 'text-embedding-3-small',
          fieldMap: { text: 'content' }
        },
        waitUntilReady: true
      });
      
      console.log('Index created successfully');
    } else {
      console.log(`Index ${indexName} already exists`);
    }
    
    return true;
  } catch (error) {
    console.error('Error creating index:', error);
    return false;
  }
}

/**
 * Populate the Pinecone index with HR policies
 */
async function populateKnowledgeBase() {
  try {
    console.log('Starting to populate knowledge base...');

    // Create the index if it doesn't exist
    const indexCreated = await createIndex();
    if (!indexCreated) {
      console.error('Failed to create or verify index');
      return;
    }

    const index = pinecone.index(indexName);

    // Process each policy
    for (const policy of hrPolicies) {
      // Prepare the record for integrated index
      const record = {
        id: uuidv4(),
        content: `${policy.title}: ${policy.content}`,
        title: policy.title,
        category: 'HR Policy'
      };

      // Upsert the record using integrated embedding
      await index.upsertRecords([record]);

      console.log(`Added policy: ${policy.title}`);
    }

    console.log('Knowledge base populated successfully!');
  } catch (error) {
    console.error('Error populating knowledge base:', error);
  }
}

// Run the script
populateKnowledgeBase()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  }); 