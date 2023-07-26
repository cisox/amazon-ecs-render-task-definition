const run = require('.');
const core = require('@actions/core');
const tmp = require('tmp');
const fs = require('fs');

jest.mock('@actions/core');
jest.mock('tmp');
jest.mock('fs', () => ({
    promises: {
        access: jest.fn()
    },
    constants: {
        O_CREATE: jest.fn()
    },
    rmdirSync: jest.fn(),
    existsSync: jest.fn(),
    writeFileSync: jest.fn()
}));

describe('Render task definition', () => {

    beforeEach(() => {
        jest.clearAllMocks();

        core.getInput = jest
            .fn()
            .mockReturnValueOnce('task-definition.json') // task-definition
            .mockReturnValueOnce('web')                  // container-name
            .mockReturnValueOnce('nginx:latest')         // image
            .mockReturnValueOnce('arn:aws:iam::1234567890:role/AmazonECSTaskRoleNew') // task-role-arn
            .mockReturnValueOnce('arn:aws:iam::1234567890:role/AmazonECSTaskExecutionRoleNew') // execution-role-arn
            .mockReturnValueOnce('efs')                  // volume-name
            .mockReturnValueOnce('fs-2345678901')        // file-system-id
            .mockReturnValueOnce('fsap-2345678901')     // access-point-id
            .mockReturnValueOnce('FOO=bar\nHELLO=world'); // environment-variables

        process.env = Object.assign(process.env, { GITHUB_WORKSPACE: __dirname });
        process.env = Object.assign(process.env, { RUNNER_TEMP: '/home/runner/work/_temp' });

        tmp.fileSync.mockReturnValue({
            name: 'new-task-def-file-name'
        });

        fs.existsSync.mockReturnValue(true);

        jest.mock('./task-definition.json', () => ({
            family: 'task-def-family',
            containerDefinitions: [
                {
                    name: "web",
                    image: "some-other-image",
                    environment: [
                        {
                            name: "FOO",
                            value: "not bar"
                        },
                        {
                            name: "DONT-TOUCH",
                            value: "me"
                        }
                    ]
                },
                {
                    name: "sidecar",
                    image: "hello"
                }
            ],
            taskRoleArn: 'arn:aws:iam::1234567890:role/AmazonECSTaskRole',
            executionRoleArn: 'arn:aws:iam::1234567890:role/AmazonECSTaskExecutionRole',
            volumes: [
                {
                    name: 'efs',
                    efsVolumeConfiguration: {
                        fileSystemId: 'fs-1234567890',
                        rootDirectory: '/',
                        transitEncryption: 'ENABLED',
                        authorizationConfig: {
                            accessPointId: 'fsap-1234567890',
                            iam: 'ENABLED'
                        }
                    }
                }
            ]
        }), { virtual: true });
    });

    test('renders the task definition and creates a new task def file', async () => {
        await run();
        expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
            tmpdir: '/home/runner/work/_temp',
            prefix: 'task-definition-',
            postfix: '.json',
            keep: true,
            discardDescriptor: true
          });
        expect(fs.writeFileSync).toHaveBeenNthCalledWith(1, 'new-task-def-file-name',
            JSON.stringify({
                family: 'task-def-family',
                containerDefinitions: [
                    {
                        name: "web",
                        image: "nginx:latest",
                        environment: [
                            {
                                name: "FOO",
                                value: "bar"
                            },
                            {
                                name: "DONT-TOUCH",
                                value: "me"
                            },
                            {
                                name: "HELLO",
                                value: "world"
                            }
                        ]
                    },
                    {
                        name: "sidecar",
                        image: "hello"
                    }
                ],
                taskRoleArn: 'arn:aws:iam::1234567890:role/AmazonECSTaskRoleNew',
                executionRoleArn: 'arn:aws:iam::1234567890:role/AmazonECSTaskExecutionRoleNew',
                volumes: [
                    {
                        name: 'efs',
                        efsVolumeConfiguration: {
                            fileSystemId: 'fs-2345678901',
                            rootDirectory: '/',
                            transitEncryption: 'ENABLED',
                            authorizationConfig: {
                                accessPointId: 'fsap-2345678901',
                                iam: 'ENABLED'
                            }
                        }
                    }
                ]
            }, null, 2)
        );
        expect(core.setOutput).toHaveBeenNthCalledWith(1, 'task-definition', 'new-task-def-file-name');
    });

    test('renders the task definition without access point id', async () => {
        core.getInput = jest
            .fn()
            .mockReturnValueOnce('task-definition-without-access-point.json') // task-definition
            .mockReturnValueOnce('web') // container-name
            .mockReturnValueOnce('nginx:latest') // image
            .mockReturnValueOnce('arn:aws:iam::1234567890:role/AmazonECSTaskRoleNew') // task-role-arn
            .mockReturnValueOnce('arn:aws:iam::1234567890:role/AmazonECSTaskExecutionRoleNew') // execution-role-arn
            .mockReturnValueOnce('efs') // volume-name
            .mockReturnValueOnce('fs-2345678901') // file-system-id
            .mockReturnValueOnce(''); // access-point-id

        jest.mock('./task-definition-without-access-point.json', () => ({
            family: 'task-def-family',
            containerDefinitions: [
                {
                    name: "web",
                    image: "some-other-image"
                }
            ],
            taskRoleArn: 'arn:aws:iam::1234567890:role/AmazonECSTaskRole',
            executionRoleArn: 'arn:aws:iam::1234567890:role/AmazonECSTaskExecutionRole',
            volumes: [
                {
                    name: 'efs',
                    efsVolumeConfiguration: {
                        fileSystemId: 'fs-1234567890',
                        rootDirectory: '/',
                        transitEncryption: 'ENABLED',
                    }
                }
            ]
        }), { virtual: true });

        await run();

        expect(fs.writeFileSync).toHaveBeenNthCalledWith(1, 'new-task-def-file-name',
            JSON.stringify({
                family: 'task-def-family',
                containerDefinitions: [
                    {
                        name: "web",
                        image: "nginx:latest"
                    }
                ],
                taskRoleArn: 'arn:aws:iam::1234567890:role/AmazonECSTaskRoleNew',
                executionRoleArn: 'arn:aws:iam::1234567890:role/AmazonECSTaskExecutionRoleNew',
                volumes: [
                    {
                        name: 'efs',
                        efsVolumeConfiguration: {
                            fileSystemId: 'fs-2345678901',
                            rootDirectory: '/',
                            transitEncryption: 'ENABLED'
                        }
                    }
                ]
            }, null, 2)
        );
    });

    test('renders the task definition with empty env', async () => {
        core.getInput = jest
            .fn()
            .mockReturnValueOnce('task-definition-with-empty-env.json') // task-definition
            .mockReturnValueOnce('web') // container-name
            .mockReturnValueOnce('nginx:latest') // image
            .mockReturnValueOnce('') // task-role-arn
            .mockReturnValueOnce('') // execlution-role-arn
            .mockReturnValueOnce('') // volume-name
            .mockReturnValueOnce('') // file-system-id
            .mockReturnValueOnce('') // access-point-id
            .mockReturnValueOnce(' ');

        jest.mock('./task-definition-with-empty-env.json', () => ({
            family: 'task-def-family',
            containerDefinitions: [
                {
                    name: "web",
                    image: "some-other-image"
                }
            ]
        }), { virtual: true });

        await run();

        expect(fs.writeFileSync).toHaveBeenNthCalledWith(1, 'new-task-def-file-name',
            JSON.stringify({
                family: 'task-def-family',
                containerDefinitions: [
                    {
                        name: "web",
                        image: "nginx:latest"
                    }
                ]
            }, null, 2)
        );
    });

    test('renders a task definition at an absolute path, and with initial environment empty', async () => {
        core.getInput = jest
            .fn()
            .mockReturnValueOnce('/hello/task-definition.json') // task-definition
            .mockReturnValueOnce('web')                  // container-name
            .mockReturnValueOnce('nginx:latest')         // image
            .mockReturnValueOnce('') // task-role-arn
            .mockReturnValueOnce('') // execution-role-arn
            .mockReturnValueOnce('') // volume-name
            .mockReturnValueOnce('') // file-system-id
            .mockReturnValueOnce('') // access-point-id
            .mockReturnValueOnce('EXAMPLE=here');        // environment-variables
        jest.mock('/hello/task-definition.json', () => ({
            family: 'task-def-family',
            containerDefinitions: [
                {
                    name: "web",
                    image: "some-other-image"
                }
            ]
        }), { virtual: true });

        await run();

        expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
            tmpdir: '/home/runner/work/_temp',
            prefix: 'task-definition-',
            postfix: '.json',
            keep: true,
            discardDescriptor: true
          });
        expect(fs.writeFileSync).toHaveBeenNthCalledWith(1, 'new-task-def-file-name',
            JSON.stringify({
                family: 'task-def-family',
                containerDefinitions: [
                    {
                        name: "web",
                        image: "nginx:latest",
                        environment: [
                            {
                                name: "EXAMPLE",
                                value: "here"
                            }
                        ]
                    }
                ]
            }, null, 2)
        );
        expect(core.setOutput).toHaveBeenNthCalledWith(1, 'task-definition', 'new-task-def-file-name');
    });

    test('error returned for missing task definition file', async () => {
        fs.existsSync.mockReturnValue(false);
        core.getInput = jest
            .fn()
            .mockReturnValueOnce('does-not-exist-task-definition.json')
            .mockReturnValueOnce('web')
            .mockReturnValueOnce('nginx:latest');

        await run();

        expect(core.setFailed).toBeCalledWith('Task definition file does not exist: does-not-exist-task-definition.json');
    });

    test('error returned for non-JSON task definition contents', async () => {
        jest.mock('./non-json-task-definition.json', () => ("hello"), { virtual: true });

        core.getInput = jest
            .fn()
            .mockReturnValueOnce('non-json-task-definition.json')
            .mockReturnValueOnce('web')
            .mockReturnValueOnce('nginx:latest');

        await run();

        expect(core.setFailed).toBeCalledWith('Invalid task definition format: containerDefinitions section is not present or is not an array');
    });

    test('error returned for malformed task definition with non-array container definition section', async () => {
        jest.mock('./malformed-task-definition-bad-containers.json', () => ({
            family: 'task-def-family',
            containerDefinitions: {}
        }), { virtual: true });

        core.getInput = jest
            .fn()
            .mockReturnValueOnce('malformed-task-definition-bad-containers.json')
            .mockReturnValueOnce('web')
            .mockReturnValueOnce('nginx:latest');

        await run();

        expect(core.setFailed).toBeCalledWith('Invalid task definition format: containerDefinitions section is not present or is not an array');
    });

    test('error returned for task definition without matching container name', async () => {
        jest.mock('./missing-container-task-definition.json', () => ({
            family: 'task-def-family',
            containerDefinitions: [
                {
                    name: "main",
                    image: "some-other-image"
                }
            ]
        }), { virtual: true });

        core.getInput = jest
            .fn()
            .mockReturnValueOnce('missing-container-task-definition.json')
            .mockReturnValueOnce('web')
            .mockReturnValueOnce('nginx:latest');

        await run();

        expect(core.setFailed).toBeCalledWith('Invalid task definition: Could not find container definition with matching name');
    });

    test('error returned for malformed task definition with non-array volume definition section', async () => {
        jest.mock('./malformed-task-definition-bad-volume.json', () => ({
            family: 'task-def-family',
            containerDefinitions: [
                {
                    name: "web",
                    image: "some-other-image"
                }
            ],
            taskRoleArn: 'arn:aws:iam::1234567890:role/AmazonECSTaskRole',
            executionRoleArn: 'arn:aws:iam::1234567890:role/AmazonECSTaskExecutionRole',
            volumes: {}
        }), { virtual: true });

        core.getInput = jest
            .fn()
            .mockReturnValueOnce('malformed-task-definition-bad-volume.json')
            .mockReturnValueOnce('web')
            .mockReturnValueOnce('nginx:latest')
            .mockReturnValueOnce('arn:aws:iam::1234567890:role/AmazonECSTaskRoleNew')
            .mockReturnValueOnce('arn:aws:iam::1234567890:role/AmazonECSTaskExecutionRoleNew')
            .mockReturnValueOnce('efs')
            .mockReturnValueOnce('fs-2345678901')
            .mockReturnValueOnce('fsap-2345678901');

        await run();

        expect(core.setFailed).toBeCalledWith('Invalid task definition format: volumes section is not present or is not an array');
    });

    test('error returned for task definition without matching volume name', async () => {
        jest.mock('./missing-volume-task-definition.json', () => ({
            family: 'task-def-family',
            containerDefinitions: [
                {
                    name: "web",
                    image: "some-other-image"
                }
            ],
            taskRoleArn: 'arn:aws:iam::1234567890:role/AmazonECSTaskRole',
            executionRoleArn: 'arn:aws:iam::1234567890:role/AmazonECSTaskExecutionRole',
            volumes: [
                {
                    name: 'main',
                    efsVolumeConfiguration: {
                        fileSystemId: 'fs-1234567890',
                        rootDirectory: '/',
                        transitEncryption: 'ENABLED',
                        authorizationConfig: {
                            accessPointId: 'fsap-1234567890',
                            iam: 'ENABLED'
                        }
                    }
                }
            ]
        }), { virtual: true });

        core.getInput = jest
            .fn()
            .mockReturnValueOnce('missing-volume-task-definition.json')
            .mockReturnValueOnce('web')
            .mockReturnValueOnce('nginx:latest')
            .mockReturnValueOnce('arn:aws:iam::1234567890:role/AmazonECSTaskRoleNew')
            .mockReturnValueOnce('arn:aws:iam::1234567890:role/AmazonECSTaskExecutionRoleNew')
            .mockReturnValueOnce('efs')
            .mockReturnValueOnce('fs-2345678901')
            .mockReturnValueOnce('fsap-2345678901');

        await run();

        expect(core.setFailed).toBeCalledWith('Invalid task definition: Could not find volume definition with matching name');
    });

    test('error returned for task definition without efsVolumeConfiguration', async () => {
        jest.mock('./missing-efs-volume-task-definition.json', () => ({
            family: 'task-def-family',
            containerDefinitions: [
                {
                    name: "web",
                    image: "some-other-image"
                }
            ],
            taskRoleArn: 'arn:aws:iam::1234567890:role/AmazonECSTaskRole',
            executionRoleArn: 'arn:aws:iam::1234567890:role/AmazonECSTaskExecutionRole',
            volumes: [
                {
                    name: 'efs'
                }
            ]
        }), { virtual: true });

        core.getInput = jest
            .fn()
            .mockReturnValueOnce('missing-efs-volume-task-definition.json')
            .mockReturnValueOnce('web')
            .mockReturnValueOnce('nginx:latest')
            .mockReturnValueOnce('arn:aws:iam::1234567890:role/AmazonECSTaskRoleNew')
            .mockReturnValueOnce('arn:aws:iam::1234567890:role/AmazonECSTaskExecutionRoleNew')
            .mockReturnValueOnce('efs')
            .mockReturnValueOnce('fs-2345678901')
            .mockReturnValueOnce('fsap-2345678901');

        await run();

        expect(core.setFailed).toBeCalledWith('Invalid task definition: Could not find efsVolumeConfiguration definition');
    });

    test('error returned for mal-formed environment', async () => {
        jest.mock('./malformed-env-task-definition.json', () => ({
            family: 'task-def-family',
            containerDefinitions: [
                {
                    name: "web",
                    image: "some-other-image"
                }
            ]
        }), { virtual: true });

        core.getInput = jest
            .fn()
            .mockReturnValueOnce('malformed-env-task-definition.json')
            .mockReturnValueOnce('web')
            .mockReturnValueOnce('nginx:latest')
            .mockReturnValueOnce('')
            .mockReturnValueOnce('')
            .mockReturnValueOnce('')
            .mockReturnValueOnce('')
            .mockReturnValueOnce('')
            .mockReturnValueOnce('EXAMPLE');

        await run();

        expect(core.setFailed).toBeCalledWith("Cannot parse the environment variable 'EXAMPLE'. Environment variable pairs must be of the form NAME=value.");
    });

    test('error returned for task definition without authorizationConfig', async () => {
        jest.mock('./missing-auth-config-task-definition.json', () => ({
            family: 'task-def-family',
            containerDefinitions: [
                {
                    name: "web",
                    image: "some-other-image"
                }
            ],
            taskRoleArn: 'arn:aws:iam::1234567890:role/AmazonECSTaskRole',
            executionRoleArn: 'arn:aws:iam::1234567890:role/AmazonECSTaskExecutionRole',
            volumes: [
                {
                    name: 'efs',
                    efsVolumeConfiguration: {
                        fileSystemId: 'fs-1234567890',
                        rootDirectory: '/',
                        transitEncryption: 'ENABLED'
                    }
                }
            ]
        }), { virtual: true });

        core.getInput = jest
            .fn()
            .mockReturnValueOnce('missing-auth-config-task-definition.json')
            .mockReturnValueOnce('web')
            .mockReturnValueOnce('nginx:latest')
            .mockReturnValueOnce('arn:aws:iam::1234567890:role/AmazonECSTaskRoleNew')
            .mockReturnValueOnce('arn:aws:iam::1234567890:role/AmazonECSTaskExecutionRoleNew')
            .mockReturnValueOnce('efs')
            .mockReturnValueOnce('fs-2345678901')
            .mockReturnValueOnce('fsap-2345678901');

        await run();

        expect(core.setFailed).toBeCalledWith('Invalid task definition: Could not find authorizationConfig definition');
    });
});
