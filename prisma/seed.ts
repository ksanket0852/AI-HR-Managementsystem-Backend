/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create Leave Types
  console.log('📝 Creating leave types...');
  const leaveTypes = await Promise.all([
    prisma.leaveType.upsert({
      where: { name: 'Annual Leave' },
      update: {},
      create: {
        name: 'Annual Leave',
        description: 'Annual vacation leave',
        maxDays: 21,
        carryForward: true,
      },
    }),
    prisma.leaveType.upsert({
      where: { name: 'Sick Leave' },
      update: {},
      create: {
        name: 'Sick Leave',
        description: 'Medical leave for illness',
        maxDays: 10,
        carryForward: false,
      },
    }),
    prisma.leaveType.upsert({
      where: { name: 'Maternity Leave' },
      update: {},
      create: {
        name: 'Maternity Leave',
        description: 'Maternity leave for new mothers',
        maxDays: 90,
        carryForward: false,
      },
    }),
    prisma.leaveType.upsert({
      where: { name: 'Paternity Leave' },
      update: {},
      create: {
        name: 'Paternity Leave',
        description: 'Paternity leave for new fathers',
        maxDays: 15,
        carryForward: false,
      },
    }),
  ]);

  // Create Departments
  console.log('🏢 Creating departments...');
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { name: 'Human Resources' },
      update: {},
      create: {
        name: 'Human Resources',
        description: 'Manages employee relations and company policies',
      },
    }),
    prisma.department.upsert({
      where: { name: 'Engineering' },
      update: {},
      create: {
        name: 'Engineering',
        description: 'Software development and technical operations',
      },
    }),
    prisma.department.upsert({
      where: { name: 'Marketing' },
      update: {},
      create: {
        name: 'Marketing',
        description: 'Brand promotion and customer acquisition',
      },
    }),
    prisma.department.upsert({
      where: { name: 'Sales' },
      update: {},
      create: {
        name: 'Sales',
        description: 'Revenue generation and client relations',
      },
    }),
    prisma.department.upsert({
      where: { name: 'Finance' },
      update: {},
      create: {
        name: 'Finance',
        description: 'Financial planning and accounting',
      },
    }),
  ]);

  // Create Admin User
  console.log('👤 Creating admin user...');
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@company.com' },
    update: {},
    create: {
      email: 'admin@company.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
    },
  });

  // Create Admin Employee Profile
  const adminEmployee = await prisma.employee.upsert({
    where: { employeeId: 'EMP001' },
    update: {},
    create: {
      employeeId: 'EMP001',
      userId: adminUser.id,
      firstName: 'System',
      lastName: 'Administrator',
      email: 'admin@company.com',
      phone: '+1234567890',
      dateOfJoining: new Date('2024-01-01'),
      departmentId: departments[0].id, // HR Department
      designation: 'System Administrator',
      salary: 100000,
      address: {
        street: '123 Admin Street',
        city: 'Tech City',
        state: 'CA',
        country: 'USA',
        zipCode: '12345',
      },
      emergencyContact: {
        name: 'Emergency Contact',
        relationship: 'Spouse',
        phone: '+1234567891',
        email: 'emergency@company.com',
      },
    },
  });

  // Create HR Manager
  console.log('👥 Creating HR Manager...');
  const hrManagerPassword = await bcrypt.hash('hr123', 12);
  
  const hrManagerUser = await prisma.user.upsert({
    where: { email: 'hr@company.com' },
    update: {},
    create: {
      email: 'hr@company.com',
      password: hrManagerPassword,
      role: 'HR_MANAGER',
    },
  });

  const hrManager = await prisma.employee.upsert({
    where: { employeeId: 'EMP002' },
    update: {},
    create: {
      employeeId: 'EMP002',
      userId: hrManagerUser.id,
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'hr@company.com',
      phone: '+1234567892',
      dateOfBirth: new Date('1985-05-15'),
      dateOfJoining: new Date('2024-01-15'),
      departmentId: departments[0].id, // HR Department
      designation: 'HR Manager',
      salary: 75000,
      address: {
        street: '456 HR Avenue',
        city: 'Tech City',
        state: 'CA',
        country: 'USA',
        zipCode: '12346',
      },
      emergencyContact: {
        name: 'John Johnson',
        relationship: 'Spouse',
        phone: '+1234567893',
      },
    },
  });

  // Update HR Department head
  await prisma.department.update({
    where: { id: departments[0].id },
    data: { headId: hrManager.id },
  });

  // Create Sample Employees
  console.log('👨‍💼 Creating sample employees...');
  const sampleEmployees = [
    {
      email: 'john.doe@company.com',
      firstName: 'John',
      lastName: 'Doe',
      employeeId: 'EMP003',
      department: departments[1].id, // Engineering
      designation: 'Senior Software Engineer',
      salary: 90000,
      managerId: null,
    },
    {
      email: 'jane.smith@company.com',
      firstName: 'Jane',
      lastName: 'Smith',
      employeeId: 'EMP004',
      department: departments[2].id, // Marketing
      designation: 'Marketing Specialist',
      salary: 60000,
      managerId: null,
    },
    {
      email: 'mike.wilson@company.com',
      firstName: 'Mike',
      lastName: 'Wilson',
      employeeId: 'EMP005',
      department: departments[3].id, // Sales
      designation: 'Sales Representative',
      salary: 55000,
      managerId: null,
    },
  ];

  for (const emp of sampleEmployees) {
    const userPassword = await bcrypt.hash('employee123', 12);
    
    const user = await prisma.user.upsert({
      where: { email: emp.email },
      update: {},
      create: {
        email: emp.email,
        password: userPassword,
        role: 'EMPLOYEE',
      },
    });

    await prisma.employee.upsert({
      where: { employeeId: emp.employeeId },
      update: {},
      create: {
        employeeId: emp.employeeId,
        userId: user.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: `+123456789${emp.employeeId.slice(-1)}`,
        dateOfBirth: new Date('1990-01-01'),
        dateOfJoining: new Date('2024-02-01'),
        departmentId: emp.department,
        designation: emp.designation,
        salary: emp.salary,
        managerId: emp.managerId,
        address: {
          street: `${emp.employeeId} Employee Street`,
          city: 'Tech City',
          state: 'CA',
          country: 'USA',
          zipCode: '12347',
        },
        emergencyContact: {
          name: `${emp.firstName} Emergency`,
          relationship: 'Family',
          phone: `+123456780${emp.employeeId.slice(-1)}`,
        },
      },
    });
  }

  // Create System Configuration
  console.log('⚙️ Creating system configuration...');
  await prisma.systemConfig.upsert({
    where: { key: 'company_name' },
    update: {},
    create: {
      key: 'company_name',
      value: 'AI HRMS Company',
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'working_hours_per_day' },
    update: {},
    create: {
      key: 'working_hours_per_day',
      value: '8',
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'working_days_per_week' },
    update: {},
    create: {
      key: 'working_days_per_week',
      value: '5',
    },
  });

  console.log('✅ Database seeding completed successfully!');
  console.log('\n📊 Created:');
  console.log(`- ${leaveTypes.length} leave types`);
  console.log(`- ${departments.length} departments`);
  console.log(`- 1 admin user (admin@company.com / admin123)`);
  console.log(`- 1 HR manager (hr@company.com / hr123)`);
  console.log(`- 3 sample employees (password: employee123)`);
  console.log('- System configuration');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 