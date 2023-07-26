const path = require('path');
const core = require('@actions/core');
const tmp = require('tmp');
const fs = require('fs');

async function run() {
  try {
    // Get inputs
    const taskDefinitionFile = core.getInput('task-definition', { required: true });
    const containerName = core.getInput('container-name', { required: true });
    const imageURI = core.getInput('image', { required: true });
    const taskRoleArn = core.getInput('task-role-arn', { required: false });
    const executionRoleArn = core.getInput('execution-role-arn', { required: false });
    const volumeName = core.getInput('volume-name', { required: false });
    const fileSystemId = core.getInput('file-system-id', { required: false });
    const accessPointId = core.getInput('access-point-id', { required: false });
    const environmentVariables = core.getInput('environment-variables', { required: false });

    // Parse the task definition
    const taskDefPath = path.isAbsolute(taskDefinitionFile) ?
      taskDefinitionFile :
      path.join(process.env.GITHUB_WORKSPACE, taskDefinitionFile);
    if (!fs.existsSync(taskDefPath)) {
      throw new Error(`Task definition file does not exist: ${taskDefinitionFile}`);
    }
    const taskDefContents = require(taskDefPath);

    // Insert the image URI
    if (!Array.isArray(taskDefContents.containerDefinitions)) {
      throw new Error('Invalid task definition format: containerDefinitions section is not present or is not an array');
    }

    const containerDef = taskDefContents.containerDefinitions.find((x) => x.name === containerName);

    if (!containerDef) {
      throw new Error('Invalid task definition: Could not find container definition with matching name');
    }

    containerDef.image = imageURI;

    // Insert the task role ARN
    if (taskRoleArn) {
      taskDefContents.taskRoleArn = taskRoleArn;
    }

    // Insert the execution role ARN
    if (executionRoleArn) {
      taskDefContents.executionRoleArn = executionRoleArn;
    }

    if (volumeName) {
      if (!Array.isArray(taskDefContents.volumes)) {
        throw new Error('Invalid task definition format: volumes section is not present or is not an array');
      }

      const volumeDef = taskDefContents.volumes.find((x) => x.name === volumeName);

      if (!volumeDef) {
        throw new Error('Invalid task definition: Could not find volume definition with matching name');
      }

      if (!('efsVolumeConfiguration' in volumeDef)) {
        throw new Error('Invalid task definition: Could not find efsVolumeConfiguration definition');
      }

      volumeDef.efsVolumeConfiguration.fileSystemId = fileSystemId;

      if (accessPointId) {
        if (!('authorizationConfig' in volumeDef.efsVolumeConfiguration)) {
          throw new Error('Invalid task definition: Could not find authorizationConfig definition');
        }

        volumeDef.efsVolumeConfiguration.authorizationConfig.accessPointId = accessPointId;
      }
    }

    if (environmentVariables) {
      const variables = environmentVariables
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .reduce((acc, line) => {
          const separatorIdx = line.indexOf("=");
          if (separatorIdx === -1) {
            throw new Error(`Cannot parse the environment variable '${line}'. Environment variable pairs must be of the form NAME=value.`);
          }
          acc[line.substring(0, separatorIdx)] = line.substring(separatorIdx + 1);
          return acc;
        }, {});

      if (Object.keys(variables).length > 0) {
        // If environment array is missing, create it
        if (!Array.isArray(containerDef.environment)) {
          containerDef.environment = [];
        }

        for (const [name, value] of Object.entries(variables)) {
          // Search container definition environment for one matching name
          const variableDef = containerDef.environment.find((e) => e.name == name);

          if (variableDef) {
            // If found, update
            variableDef.value = value;
          } else {
            // Else, create
            containerDef.environment.push({
              name,
              value
            });
          }
        }
      }
    }

    // Write out a new task definition file
    var updatedTaskDefFile = tmp.fileSync({
      tmpdir: process.env.RUNNER_TEMP,
      prefix: 'task-definition-',
      postfix: '.json',
      keep: true,
      discardDescriptor: true
    });
    const newTaskDefContents = JSON.stringify(taskDefContents, null, 2);
    fs.writeFileSync(updatedTaskDefFile.name, newTaskDefContents);
    core.setOutput('task-definition', updatedTaskDefFile.name);
  }
  catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = run;

/* istanbul ignore next */
if (require.main === module) {
    run();
}
