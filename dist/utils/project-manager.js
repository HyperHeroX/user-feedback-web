/**
 * ProjectManager - 管理多專案 Session
 *
 * 負責專案的建立、查詢和生命週期管理
 */
import { createHash } from 'crypto';
import { logger } from './logger.js';
export class ProjectManager {
    projects = new Map();
    static instance = null;
    constructor() { }
    static getInstance() {
        if (!ProjectManager.instance) {
            ProjectManager.instance = new ProjectManager();
        }
        return ProjectManager.instance;
    }
    static resetInstance() {
        ProjectManager.instance = null;
    }
    generateProjectId(name, path) {
        const source = path || name;
        return createHash('sha256').update(source).digest('hex').slice(0, 16);
    }
    getOrCreateProject(name, path) {
        const projectId = this.generateProjectId(name, path);
        const existing = this.projects.get(projectId);
        if (existing) {
            existing.lastActiveAt = new Date().toISOString();
            logger.debug(`Project activity updated: ${name} (${projectId})`);
            return existing;
        }
        const now = new Date().toISOString();
        const newProject = {
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
    getDefaultProject() {
        return this.getOrCreateProject('Default');
    }
    getProject(id) {
        return this.projects.get(id);
    }
    getProjectByName(name) {
        for (const project of this.projects.values()) {
            if (project.name === name) {
                return project;
            }
        }
        return undefined;
    }
    getAllProjects() {
        return Array.from(this.projects.values());
    }
    updateLastActive(id) {
        const project = this.projects.get(id);
        if (project) {
            project.lastActiveAt = new Date().toISOString();
        }
    }
    deleteProject(id) {
        return this.projects.delete(id);
    }
    clear() {
        this.projects.clear();
        logger.info('All projects cleared');
    }
    getStats() {
        const projects = this.getAllProjects();
        return {
            totalProjects: projects.length,
            projectNames: projects.map(p => p.name),
        };
    }
}
export const projectManager = ProjectManager.getInstance();
//# sourceMappingURL=project-manager.js.map