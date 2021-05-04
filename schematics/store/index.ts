import {
  Rule, Tree, SchematicsException,
  apply, url, applyTemplates, move,
  chain, mergeWith
} from '@angular-devkit/schematics';
import { strings, normalize, virtualFs, workspaces } from '@angular-devkit/core';
import { Schema as StoreServiceSchema } from './schema';

export function StoreService(options: StoreServiceSchema): Rule {
  return async (tree: Tree) => {
    const host = createHost(tree);
    const { workspace } = await workspaces.readWorkspace('/', host);
    /*
     * The WorkspaceDefinition, extensions property includes a defaultProject value for determining which project to use if not provided.
     * We will use that value as a fallback, if no project is explicitly specified in the ng generate command
    */
    if (!options.project) {
      options.project = workspace.extensions.defaultProject;
    }
    /*
     * Now that you have the project name, use it to retrieve the project-specific configuration information.
    */
    const project = workspace.projects.get(options.project);
    if (!project) {
      throw new SchematicsException(`Invalid project name: ${options.project}`);
    }

    const projectType = project.extensions.projectType === 'application' ? 'app' : 'lib';

    /* The options.path determines where the schematic template files are moved to once the schematic is applied.
     * The path option in the schematic's schema is substituted by default with the current working directory.
     * If the path is not defined, use the sourceRoot from the project configuration along with the projectType.
     */

    let statePath: string = `../states/${options.name.replace(/(?!^)([A-Z]|\d+)/g, "-$1")}.state`.toLocaleLowerCase();
    let path = `${project.sourceRoot}/${projectType}`;

    const stateTemplateSource = apply(url('../state/files'), [
      applyTemplates({
        classify: strings.classify,
        dasherize: strings.dasherize,
        name: options.name,
      }),
      move(normalize(path+'/states' as string))
    ]);

    const storeTemplateSource = apply(url('./files'), [
      applyTemplates({
        classify: strings.classify,
        dasherize: strings.dasherize,
        name: options.name,
        path: statePath
      }),
      move(normalize(path+'/stores' as string))
    ]);


    return chain([
      mergeWith(storeTemplateSource),
      mergeWith(stateTemplateSource)
    ]);
  };
}

function createHost(tree: Tree): workspaces.WorkspaceHost {
  return {
    async readFile(path: string): Promise<string> {
      const data = tree.read(path);
      if (!data) {
        throw new SchematicsException('File not found.');
      }
      return virtualFs.fileBufferToString(data);
    },
    async writeFile(path: string, data: string): Promise<void> {
      return tree.overwrite(path, data);
    },
    async isDirectory(path: string): Promise<boolean> {
      return !tree.exists(path) && tree.getDir(path).subfiles.length > 0;
    },
    async isFile(path: string): Promise<boolean> {
      return tree.exists(path);
    },
  };
}

