import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedDummyData() {
  console.log('🌱 Starting dummy data seeding...');

  try {
    // Create departments
    const departments = await Promise.all([
      prisma.department.upsert({
        where: { name: 'Engineering' },
        update: {},
        create: {
          name: 'Engineering',
          description: 'Software development and technical teams',
          isActive: true
        }
      }),
      prisma.department.upsert({
        where: { name: 'Human Resources' },
        update: {},
        create: {
          name: 'Human Resources',
          description: 'HR and talent management',
          isActive: true
        }
      }),
      prisma.department.upsert({
        where: { name: 'Marketing' },
        update: {},
        create: {
          name: 'Marketing',
          description: 'Marketing and communications',
          isActive: true
        }
      }),
      prisma.department.upsert({
        where: { name: 'Sales' },
        update: {},
        create: {
          name: 'Sales',
          description: 'Sales and business development',
          isActive: true
        }
      })
    ]);

    console.log('✅ Created departments');

    // Create users
    const users = await Promise.all([
      prisma.user.upsert({
        where: { email: 'admin@company.com' },
        update: {},
        create: {
          email: 'admin@company.com',
          password: await bcrypt.hash('admin123', 10),
          role: 'SUPER_ADMIN',
          isActive: true
        }
      }),
      prisma.user.upsert({
        where: { email: 'hr@company.com' },
        update: {},
        create: {
          email: 'hr@company.com',
          password: await bcrypt.hash('hr123', 10),
          role: 'HR_ADMIN',
          isActive: true
        }
      }),
      prisma.user.upsert({
        where: { email: 'manager@company.com' },
        update: {},
        create: {
          email: 'manager@company.com',
          password: await bcrypt.hash('manager123', 10),
          role: 'MANAGER',
          isActive: true
        }
      }),
      prisma.user.upsert({
        where: { email: 'employee@company.com' },
        update: {},
        create: {
          email: 'employee@company.com',
          password: await bcrypt.hash('employee123', 10),
          role: 'EMPLOYEE',
          isActive: true
        }
      })
    ]);

    console.log('✅ Created users');

    // Create employees
    const employees = await Promise.all([
      prisma.employee.create({
        data: {
          employeeId: 'EMP001',
          userId: users[0].id,
          firstName: 'Admin',
          lastName: 'User',
          email: 'admin@company.com',
          phone: '+1-555-0101',
          dateOfJoining: new Date('2020-01-15'),
          departmentId: departments[0].id,
          designation: 'System Administrator',
          salary: 120000,
          isActive: true,
          address: {
            street: '123 Admin St',
            city: 'San Francisco',
            state: 'CA',
            zipCode: '94105',
            country: 'USA'
          }
        }
      }),
      prisma.employee.create({
        data: {
          employeeId: 'EMP002',
          userId: users[1].id,
          firstName: 'Sarah',
          lastName: 'Johnson',
          email: 'hr@company.com',
          phone: '+1-555-0102',
          dateOfJoining: new Date('2019-03-20'),
          departmentId: departments[1].id,
          designation: 'HR Manager',
          salary: 95000,
          isActive: true,
          address: {
            street: '456 HR Ave',
            city: 'San Francisco',
            state: 'CA',
            zipCode: '94105',
            country: 'USA'
          }
        }
      }),
      prisma.employee.create({
        data: {
          employeeId: 'EMP003',
          userId: users[2].id,
          firstName: 'Michael',
          lastName: 'Chen',
          email: 'manager@company.com',
          phone: '+1-555-0103',
          dateOfJoining: new Date('2018-06-10'),
          departmentId: departments[0].id,
          designation: 'Engineering Manager',
          salary: 130000,
          isActive: true,
          address: {
            street: '789 Manager Blvd',
            city: 'San Francisco',
            state: 'CA',
            zipCode: '94105',
            country: 'USA'
          }
        }
      }),
      prisma.employee.create({
        data: {
          employeeId: 'EMP004',
          userId: users[3].id,
          firstName: 'Emily',
          lastName: 'Davis',
          email: 'employee@company.com',
          phone: '+1-555-0104',
          dateOfJoining: new Date('2021-09-15'),
          departmentId: departments[0].id,
          designation: 'Software Developer',
          salary: 85000,
          isActive: true,
          address: {
            street: '321 Developer Dr',
            city: 'San Francisco',
            state: 'CA',
            zipCode: '94105',
            country: 'USA'
          }
        }
      })
    ]);

    console.log('✅ Created employees');

    // Create candidates
    const candidates = await Promise.all([
      prisma.candidate.create({
        data: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '+1-555-0201',
          dateOfBirth: new Date('1990-05-15'),
          profileSummary: 'Experienced full-stack developer with 5+ years in React and Node.js. Passionate about building scalable web applications.',
          totalExperience: 5.5,
          expectedSalary: 120000,
          currentSalary: 95000,
          noticePeriod: '2 weeks',
          status: 'NEW',
          source: 'LinkedIn',
          linkedinUrl: 'https://linkedin.com/in/johndoe',
          githubUrl: 'https://github.com/johndoe',
          portfolioUrl: 'https://johndoe.dev',
          skills: [
            { name: 'React', proficiency: 'expert' },
            { name: 'Node.js', proficiency: 'expert' },
            { name: 'TypeScript', proficiency: 'advanced' },
            { name: 'MongoDB', proficiency: 'intermediate' },
            { name: 'AWS', proficiency: 'intermediate' }
          ]
        }
      }),
      prisma.candidate.create({
        data: {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          phone: '+1-555-0202',
          dateOfBirth: new Date('1988-12-03'),
          profileSummary: 'Senior frontend developer specializing in React and Vue.js. Strong background in UI/UX design.',
          totalExperience: 7.0,
          expectedSalary: 140000,
          currentSalary: 115000,
          noticePeriod: '1 month',
          status: 'REVIEWED',
          source: 'Indeed',
          linkedinUrl: 'https://linkedin.com/in/janesmith',
          githubUrl: 'https://github.com/janesmith',
          skills: [
            { name: 'React', proficiency: 'expert' },
            { name: 'Vue.js', proficiency: 'expert' },
            { name: 'JavaScript', proficiency: 'expert' },
            { name: 'CSS', proficiency: 'expert' },
            { name: 'Figma', proficiency: 'advanced' }
          ]
        }
      }),
      prisma.candidate.create({
        data: {
          firstName: 'Alex',
          lastName: 'Wilson',
          email: 'alex.wilson@example.com',
          phone: '+1-555-0203',
          dateOfBirth: new Date('1992-08-22'),
          profileSummary: 'Backend developer with expertise in Python, Django, and microservices architecture.',
          totalExperience: 4.0,
          expectedSalary: 110000,
          currentSalary: 85000,
          noticePeriod: '3 weeks',
          status: 'SHORTLISTED',
          source: 'Referral',
          linkedinUrl: 'https://linkedin.com/in/alexwilson',
          githubUrl: 'https://github.com/alexwilson',
          skills: [
            { name: 'Python', proficiency: 'expert' },
            { name: 'Django', proficiency: 'expert' },
            { name: 'PostgreSQL', proficiency: 'advanced' },
            { name: 'Docker', proficiency: 'intermediate' },
            { name: 'Kubernetes', proficiency: 'beginner' }
          ]
        }
      }),
      prisma.candidate.create({
        data: {
          firstName: 'Maria',
          lastName: 'Garcia',
          email: 'maria.garcia@example.com',
          phone: '+1-555-0204',
          dateOfBirth: new Date('1995-03-10'),
          profileSummary: 'DevOps engineer with strong experience in AWS, CI/CD pipelines, and infrastructure automation.',
          totalExperience: 3.5,
          expectedSalary: 125000,
          currentSalary: 90000,
          noticePeriod: '2 weeks',
          status: 'INTERVIEW_SCHEDULED',
          source: 'Company Website',
          linkedinUrl: 'https://linkedin.com/in/mariagarcia',
          githubUrl: 'https://github.com/mariagarcia',
          skills: [
            { name: 'AWS', proficiency: 'expert' },
            { name: 'Docker', proficiency: 'expert' },
            { name: 'Kubernetes', proficiency: 'advanced' },
            { name: 'Terraform', proficiency: 'advanced' },
            { name: 'Jenkins', proficiency: 'intermediate' }
          ]
        }
      }),
      prisma.candidate.create({
        data: {
          firstName: 'David',
          lastName: 'Brown',
          email: 'david.brown@example.com',
          phone: '+1-555-0205',
          dateOfBirth: new Date('1987-11-18'),
          profileSummary: 'Mobile app developer with expertise in React Native and Flutter. Experience in both iOS and Android development.',
          totalExperience: 6.0,
          expectedSalary: 130000,
          currentSalary: 105000,
          noticePeriod: '1 month',
          status: 'INTERVIEWED',
          source: 'LinkedIn',
          linkedinUrl: 'https://linkedin.com/in/davidbrown',
          githubUrl: 'https://github.com/davidbrown',
          skills: [
            { name: 'React Native', proficiency: 'expert' },
            { name: 'Flutter', proficiency: 'expert' },
            { name: 'Swift', proficiency: 'advanced' },
            { name: 'Kotlin', proficiency: 'advanced' },
            { name: 'Firebase', proficiency: 'intermediate' }
          ]
        }
      })
    ]);

    console.log('✅ Created candidates');

    // Create jobs
    const jobs = await Promise.all([
      prisma.job.create({
        data: {
          title: 'Senior Full Stack Developer',
          departmentId: departments[0].id,
          description: 'We are looking for a senior full-stack developer to join our engineering team. You will be responsible for building scalable web applications using modern technologies.',
          requirements: [
            '5+ years of experience in full-stack development',
            'Strong knowledge of React and Node.js',
            'Experience with TypeScript',
            'Knowledge of database design and optimization',
            'Experience with cloud platforms (AWS preferred)',
            'Strong problem-solving skills',
            'Excellent communication skills'
          ],
          skills: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'AWS', 'Docker'],
          experienceMin: 5,
          experienceMax: 8,
          salaryMin: 120000,
          salaryMax: 160000,
          location: 'San Francisco, CA',
          type: 'FULL_TIME',
          status: 'OPEN',
          postedBy: employees[2].id, // Engineering Manager
          postedAt: new Date(),
          closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        }
      }),
      prisma.job.create({
        data: {
          title: 'Frontend Developer',
          departmentId: departments[0].id,
          description: 'Join our frontend team to build beautiful and responsive user interfaces. We use React and modern CSS frameworks.',
          requirements: [
            '3+ years of experience in frontend development',
            'Proficiency in React and JavaScript',
            'Experience with CSS and responsive design',
            'Knowledge of modern build tools',
            'Experience with version control (Git)',
            'Attention to detail and design sense'
          ],
          skills: ['React', 'JavaScript', 'CSS', 'HTML', 'Git', 'Webpack'],
          experienceMin: 3,
          experienceMax: 6,
          salaryMin: 80000,
          salaryMax: 120000,
          location: 'San Francisco, CA',
          type: 'FULL_TIME',
          status: 'OPEN',
          postedBy: employees[2].id,
          postedAt: new Date(),
          closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      }),
      prisma.job.create({
        data: {
          title: 'DevOps Engineer',
          departmentId: departments[0].id,
          description: 'We need a DevOps engineer to help us scale our infrastructure and improve our deployment processes.',
          requirements: [
            '4+ years of experience in DevOps',
            'Strong knowledge of AWS services',
            'Experience with Docker and Kubernetes',
            'Knowledge of CI/CD pipelines',
            'Experience with infrastructure as code',
            'Strong scripting skills (Python/Bash)',
            'Experience with monitoring and logging'
          ],
          skills: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'Jenkins', 'Python'],
          experienceMin: 4,
          experienceMax: 7,
          salaryMin: 110000,
          salaryMax: 150000,
          location: 'San Francisco, CA',
          type: 'FULL_TIME',
          status: 'OPEN',
          postedBy: employees[2].id,
          postedAt: new Date(),
          closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      }),
      prisma.job.create({
        data: {
          title: 'Mobile App Developer',
          departmentId: departments[0].id,
          description: 'Join our mobile team to develop cross-platform mobile applications using React Native.',
          requirements: [
            '3+ years of experience in mobile development',
            'Experience with React Native or Flutter',
            'Knowledge of mobile app architecture',
            'Experience with app store deployment',
            'Understanding of mobile UI/UX principles',
            'Experience with mobile testing'
          ],
          skills: ['React Native', 'Flutter', 'JavaScript', 'iOS', 'Android', 'Firebase'],
          experienceMin: 3,
          experienceMax: 6,
          salaryMin: 90000,
          salaryMax: 130000,
          location: 'San Francisco, CA',
          type: 'FULL_TIME',
          status: 'OPEN',
          postedBy: employees[2].id,
          postedAt: new Date(),
          closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      })
    ]);

    console.log('✅ Created jobs');

    // Create job applications
    const applications = await Promise.all([
      prisma.jobApplication.create({
        data: {
          candidateId: candidates[0].id,
          jobId: jobs[0].id,
          coverLetter: 'I am excited to apply for the Senior Full Stack Developer position. With my 5+ years of experience in React and Node.js, I believe I would be a great fit for your team.',
          status: 'SUBMITTED',
          appliedAt: new Date(),
          notes: 'Strong technical background, good communication skills'
        }
      }),
      prisma.jobApplication.create({
        data: {
          candidateId: candidates[1].id,
          jobId: jobs[1].id,
          coverLetter: 'I am passionate about frontend development and would love to contribute to your team. My experience with React and modern CSS frameworks makes me a strong candidate.',
          status: 'UNDER_REVIEW',
          appliedAt: new Date(),
          notes: 'Excellent portfolio, strong design skills'
        }
      }),
      prisma.jobApplication.create({
        data: {
          candidateId: candidates[2].id,
          jobId: jobs[0].id,
          coverLetter: 'As a backend developer with Python expertise, I am excited about the opportunity to work on full-stack projects and expand my skills.',
          status: 'SHORTLISTED',
          appliedAt: new Date(),
          notes: 'Good technical skills, needs frontend experience'
        }
      }),
      prisma.jobApplication.create({
        data: {
          candidateId: candidates[3].id,
          jobId: jobs[2].id,
          coverLetter: 'My DevOps experience with AWS and Kubernetes makes me a perfect fit for this role. I am excited about the opportunity to scale your infrastructure.',
          status: 'INTERVIEW_SCHEDULED',
          appliedAt: new Date(),
          notes: 'Perfect match for DevOps role'
        }
      }),
      prisma.jobApplication.create({
        data: {
          candidateId: candidates[4].id,
          jobId: jobs[3].id,
          coverLetter: 'With my experience in React Native and Flutter, I am confident I can help build amazing mobile applications for your users.',
          status: 'INTERVIEWED',
          appliedAt: new Date(),
          notes: 'Strong mobile development background'
        }
      })
    ]);

    console.log('✅ Created job applications');

    // Create interviews
    const interviews = await Promise.all([
      prisma.interview.create({
        data: {
          candidateId: candidates[3].id,
          jobId: jobs[2].id,
          interviewerId: employees[2].id,
          type: 'TECHNICAL',
          scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          duration: 60,
          location: 'Conference Room A',
          status: 'SCHEDULED',
          notes: 'Technical interview focusing on AWS and Kubernetes'
        }
      }),
      prisma.interview.create({
        data: {
          candidateId: candidates[4].id,
          jobId: jobs[3].id,
          interviewerId: employees[2].id,
          type: 'TECHNICAL',
          scheduledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          duration: 45,
          location: 'Video Call',
          status: 'COMPLETED',
          feedback: 'Strong technical skills, good communication',
          rating: 4.2,
          notes: 'Candidate performed well in technical questions'
        }
      })
    ]);

    console.log('✅ Created interviews');

    // Create some chat messages for testing
    const chatMessages = await Promise.all([
      prisma.chatMessage.create({
        data: {
          userId: users[1].id, // HR user
          message: 'Hello! I have a question about our vacation policy.',
          response: 'Hello! I\'d be happy to help you with information about our vacation policy. Employees are entitled to 20 days of paid vacation per year.',
          context: {
            topic: 'vacation_policy',
            department: 'HR'
          }
        }
      }),
      prisma.chatMessage.create({
        data: {
          userId: users[3].id, // Employee user
          message: 'What is the process for requesting sick leave?',
          response: 'To request sick leave, you can submit a request through our HR portal or contact your manager directly. Employees can take up to 10 paid sick days per year.',
          context: {
            topic: 'sick_leave',
            department: 'HR'
          }
        }
      })
    ]);

    console.log('✅ Created chat messages');

    console.log('🎉 Dummy data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- ${departments.length} departments created`);
    console.log(`- ${users.length} users created`);
    console.log(`- ${employees.length} employees created`);
    console.log(`- ${candidates.length} candidates created`);
    console.log(`- ${jobs.length} jobs created`);
    console.log(`- ${applications.length} job applications created`);
    console.log(`- ${interviews.length} interviews created`);
    console.log(`- ${chatMessages.length} chat messages created`);
    
    console.log('\n🔑 Test Credentials:');
    console.log('Admin: admin@company.com / admin123');
    console.log('HR: hr@company.com / hr123');
    console.log('Manager: manager@company.com / manager123');
    console.log('Employee: employee@company.com / employee123');

  } catch (error) {
    console.error('❌ Error seeding dummy data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding function
if (require.main === module) {
  seedDummyData()
    .then(() => {
      console.log('✅ Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

export default seedDummyData;
