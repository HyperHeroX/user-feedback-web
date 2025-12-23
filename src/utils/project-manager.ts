/**
 * ProjectManager - 管理多專案 Session
 * 
 * 負責專案的建立、查詢和生命週期管理
 */

import { createHash } from 'crypto';
import { Project, DashboardProjectInfo, DashboardSessionInfo } from '../types/index.js';
import { logger } from './logger.js';

export class ProjectManager {
  private projects: Map<string, Project> = new Map();
  private static instance: ProjectManager | null = null;
  
  private constructor() {}
  
  static getInstance(): ProjectManager {
    if (!ProjectManager.instance) {
      ProjectManager.instance = new ProjectManager();
    }
    return ProjectManager.instance;
  }
  
  static resetInstance(): void {
    ProjectManager.instance = null;
  }
  
  private generateProjectId(name: string, path?: string): string {
    const source = path || name;
    return createHash('sha256').update(source).digest('hex').slice(0, 16);
  }
  
  getOrCreateProject(name: string, path?: string): Project {
    const projectId = this.generateProjectId(name, path);
    
    const existing = this.projects.get(projectId);
    if (existing) {
      existing.lastActiveAt = new Date().toISOString();
      logger.debug(`Project activity updated: ${name} (${projectId})`);
      return existing;
    }
    
    const now = new Date().toISOString();
    const newProject: Project = {
      id: projectId,
      name,
      path,
      createdAt: now,
      lastActiveAt: now,
    };
    
    this.projects.set(projectId, newProject);
    logger.info(`New project created: ${name} (${projectId})`);
    return newProject;
  }
  
  getDefaultProject(): Project {
    return this.getOrCreateProject('Default');
  }
  
  getProject(id: string): Project | undefined {
    return this.projects.get(id);
  }
  
  getProjectByName(name: string): Project | undefined {
    for (const project of this.projects.values()) {
      if (project.name === name) {
        return project;
      }
    }
    return undefined;
  }
  
  getAllProjects(): Project[] {
    return Array.from(this.projects.values());
  }
  
  updateLastActive(id: string): void {
    const project = this.projects.get(id);
    if (project) {
      project.lastActiveAt = new Date().toISOString();
    }
  }
  
  deleteProject(id: string): boolean {
    return this.projects.delete(id);
  }
  
  clear(): void {
    this.projects.clear();
    logger.info('All projects cleared');
  }
  
  getStats(): { totalProjects: number; projectNames: string[] } {
    const projects = this.getAllProjects();
    return {
      totalProjects: projects.length,
      projectNames: projects.map(p => p.name),
    };
  }
}

export const projectManager = ProjectManager.getInstance();
