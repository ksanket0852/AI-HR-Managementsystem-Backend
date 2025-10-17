export interface CreateDepartmentDto {
  name: string;
  description?: string;
  headId?: string;
}

export interface UpdateDepartmentDto {
  name?: string;
  description?: string;
  headId?: string;
  isActive?: boolean;
} 