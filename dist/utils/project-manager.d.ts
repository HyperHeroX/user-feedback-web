/**
 * ProjectManager - 管理多專案 Session
 *
 * 負責專案的建立、查詢和生命週期管理
 */
import { Project } from '../types/index.js';
export declare class ProjectManager {
    private projects;
    private static instance;
    private constructor();
    static getInstance(): ProjectManager;
    static resetInstance(): void;
    private generateProjectId;
    getOrCreateProject(name: string, path?: string): Project;
    getDefaultProject(): Project;
    getProject(id: string): Project | undefined;
    getProjectByName(name: string): Project | undefined;
    getAllProjects(): Project[];
    updateLastActive(id: string): void;
    deleteProject(id: string): boolean;
    clear(): void;
    getStats(): {
        totalProjects: number;
        projectNames: string[];
    };
}
export declare const projectManager: ProjectManager;
//# sourceMappingURL=project-manager.d.ts.map