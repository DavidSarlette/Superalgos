exports.newSuperalgosBotModulesFromOneMinToMultiPeriodMarket = function (processIndex) {
    /*
        This module is about converting a One-Min Daily typeo of data set into a Multi Period Market type.

        The process to do so involves:
    
        Reading the elements (elements, volumens, bolllinger bands, news, asset metrics, etc.) from a
        One-Min Dataset (a dataset that is organized with elements spanning one min, like one min begin-end-elements,
        or elements with a timestamp captured approximatelly one minute from each other)
        organized in Daily Files.
        
        It is going to output a Market Files dataset for every Market Time Frame, aggregating the 
        input information into elements with a begin and end property. 
        
        Everytime this process runs, it will be able to resume its job and process everything pending until 
        reaching the head of the market. To achieve that it will follow this strategy:
    
        1. First it will read the last file written by this same process, and load all the information into 
        in-memory arrays (one array for each time frame). 
        
        2. Then it will append to these arrays the new information it gets from the data dependency file.
    
        3. The already saved elements belonging to the start processing day will be discarded and replaced by the
        dependency elements of the same day, potentially completing missing elements.         
    */
    const MODULE_NAME = "From One Min To Multi Period Market"

    let thisObject = {
        initialize: initialize,
        finalize: finalize,
        start: start
    }

    let fileStorage = TS.projects.superalgos.taskModules.fileStorage.newFileStorage(processIndex)

    let statusDependenciesModule
    let dataDependenciesModule
    let node = {}               // Usefull nodes for this module will be stored here.

    return thisObject;

    function initialize(pStatusDependencies, pDataDependencies, callBackFunction) {

        statusDependenciesModule = pStatusDependencies
        dataDependenciesModule = pDataDependencies
        TS.projects.superalgos.functionLibraries.dataAggregationFunctions.checkForKnownConstraints(
            dataDependenciesModule,
            node,
            processIndex,
            callBackFunction
        )
    }

    function finalize() {
        fileStorage = undefined
        statusDependenciesModule = undefined
        dataDependenciesModule = undefined
        thisObject = undefined
        node = undefined
    }

    function start(callBackFunction) {

        try {
            /* Context Variables */
            let contextVariables = {
                datetimeLastProducedFile: undefined,                        // Datetime of the last file files successfully produced by this process.
                datetimeBeginingOfMarketFile: undefined,                    // Datetime of the first trade file in the whole market history.
                datetimeLastAvailableDependencyFile: undefined,             // Datetime of the last file available to be used as an input of this process.
                beginingOfMarket: undefined                                 // Datetime of the begining of the market.
            }

            TS.projects.superalgos.functionLibraries.dataAggregationFunctions.getContextVariables(
                statusDependenciesModule,
                contextVariables,
                loadExistingFiles,
                buildOutput,
                processIndex,
                callBackFunction
            )

            function loadExistingFiles() {
                /*
                This is where we read the current files we have produced at previous runs 
                of this same process. We just read all the content and organize it
                in arrays and keep them in memory.
                */
                try {
                    let timeFrameArrayIndex = 0                         // loop Variable representing each possible time frame as defined at the time frames array.
                    let allPreviousElements = []                        // Each item of this array is an array of elements for a certain time frame

                    loopBody()

                    function loopBody() {
                        const TIME_FRAME_LABEL = TS.projects.superalgos.globals.timeFrames.marketFilesPeriods()[timeFrameArrayIndex][1];

                        let previousElements

                        readExistingFile()

                        function readExistingFile() {
                            let fileName = 'Data.json';
                            let filePath =
                                TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).FILE_PATH_ROOT +
                                "/Output/" +
                                node.outputDataset.referenceParent.parentNode.config.codeName + "/" + // Product Name
                                TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.config.codeName + "/" +
                                TIME_FRAME_LABEL;
                            filePath += '/' + fileName

                            fileStorage.getTextFile(filePath, onFileReceived)

                            function onFileReceived(err, text) {
                                let dependencyDailyFile

                                if (err.result === TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result) {
                                    try {
                                        dependencyDailyFile = JSON.parse(text)
                                        previousElements = dependencyDailyFile;
                                        allPreviousElements.push(previousElements)

                                        controlLoop()

                                    } catch (err) {
                                        TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                            "[ERROR] start -> loadExistingFiles -> loopBody -> readExistingFile -> onFileReceived -> fileName = " + fileName)
                                        TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                            "[ERROR] start -> loadExistingFiles -> loopBody -> readExistingFile -> onFileReceived -> filePath = " + filePath)
                                        TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                            "[ERROR] start -> loadExistingFiles -> loopBody -> readExistingFile -> onFileReceived -> err = " + err.stack)
                                        TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                            "[ERROR] start -> loadExistingFiles -> loopBody -> readExistingFile -> onFileReceived -> Asuming this is a temporary situation. Requesting a Retry.")
                                        callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE)
                                    }
                                } else {
                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                        "[ERROR] start -> loadExistingFiles -> loopBody -> readExistingFile -> onFileReceived -> err = " + err.stack)
                                    callBackFunction(err)
                                }
                            }
                        }
                    }

                    function controlLoop() {
                        timeFrameArrayIndex++
                        if (timeFrameArrayIndex < TS.projects.superalgos.globals.timeFrames.marketFilesPeriods().length) {
                            loopBody()
                        } else {
                            buildOutput(allPreviousElements)
                        }
                    }
                }
                catch (err) {
                    TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                        "[ERROR] start -> loadExistingFiles -> err = " + err.stack)
                    callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE)
                }
            }

            function buildOutput(allPreviousElements) {

                try {
                    let fromDate = new Date(contextVariables.datetimeLastProducedFile.valueOf())
                    let lastDate = TS.projects.superalgos.utilities.dateTimeFunctions.removeTime(new Date())
                    /*
                    Firstly we prepere the arrays that will accumulate all the information for each output file.
                    */
                    let outputElements = []

                    for (let timeFrameArrayIndex = 0; timeFrameArrayIndex < TS.projects.superalgos.globals.timeFrames.marketFilesPeriods().length; timeFrameArrayIndex++) {
                        const emptyArray = []
                        outputElements.push(emptyArray)
                    }
                    moveToNextDay()

                    function moveToNextDay() {
                        TS.projects.superalgos.functionLibraries.dataAggregationFunctions.advanceTime(
                            fromDate,
                            lastDate,
                            contextVariables,
                            timeframesLoop,
                            processIndex,
                            callBackFunction
                        )
                    }

                    function timeframesLoop() {
                        /*
                        We will iterate through all posible time frames.
                        */
                        let timeFrameArrayIndex = 0   // loop Variable representing each possible period as defined at the periods array.

                        loopBody()

                        function loopBody() {
                            let previousElements // This is an array with all the elements already existing for a certain time frame.

                            if (allPreviousElements !== undefined) {
                                previousElements = allPreviousElements[timeFrameArrayIndex];
                            }

                            const TIME_FRAME_VALUE = TS.projects.superalgos.globals.timeFrames.marketFilesPeriods()[timeFrameArrayIndex][0]
                            const TIME_FRAME_LABEL = TS.projects.superalgos.globals.timeFrames.marketFilesPeriods()[timeFrameArrayIndex][1]
                            /*
                            Here we are inside a Loop that is going to advance 1 day at the time, 
                            at each pass, we will read one of Exchange Raw Data's daily files and
                            add all its elements to our in memory arrays. 
                            
                            At the first iteration of this loop, we will add the elements that we are carrying
                            from our previous run, the ones we already have in-memory. 

                            You can see below how we discard the elements that
                            belong to the first day we are processing at this run, 
                            that it is exactly the same as the last day processed the previous
                            run. By discarding these elements, we are ready to run after that standard 
                            function that will just add ALL the elements found each day at Exchange Raw Data.
                            */
                            if (previousElements !== undefined && previousElements.length !== 0) {
                                for (let i = 0; i < previousElements.length; i++) {
                                    let element = {}

                                    for (let j = 0; j < node.outputDataset.referenceParent.parentNode.record.properties.length; j++) {
                                        let property = node.outputDataset.referenceParent.parentNode.record.properties[j]
                                        element[property.config.codeName] = record[j]
                                    }

                                    if (element.end < contextVariables.datetimeLastProducedFile.valueOf()) {
                                        outputElements[timeFrameArrayIndex].push(element)
                                    } else {
                                        TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                            "[INFO] start -> buildOutput -> timeframesLoop -> loopBody -> Element # " + i + " @ " + TIME_FRAME_LABEL + " discarded for closing past the current process time.")
                                    }
                                }
                                allPreviousElements[timeFrameArrayIndex] = [] // erasing these so as not to duplicate them.
                            }

                            TS.projects.superalgos.functionLibraries.dataAggregationFunctions.nextDependencyDailyFile(
                                contextVariables,
                                node,
                                aggregateAndWriteOutputFile,
                                fileStorage,
                                processIndex,
                                callBackFunction
                            )

                            function aggregateAndWriteOutputFile(dependencyDailyFile) {
                                /*
                                Here we call the function that will aggregate all the information 
                                at the dependency file into standarized begin-end-elements. 
                                */
                                TS.projects.superalgos.functionLibraries.dataAggregationFunctions.aggregateFileContent(
                                    node,
                                    contextVariables,
                                    dependencyDailyFile,
                                    outputElements[timeFrameArrayIndex],
                                    TIME_FRAME_VALUE
                                )

                                writeOutputFile(outputElements[timeFrameArrayIndex], TIME_FRAME_LABEL, controlLoop)

                                function writeOutputFile(outputElementsCurrentTimeFrame, TIME_FRAME_LABEL, callBack) {
                                    /*
                                    Here we will write the contents of the file to disk.
                                    */
                                    try {
                                        let fileContent = TS.projects.superalgos.functionLibraries.dataAggregationFunctions.generateOutputFileContent(
                                            node,
                                            outputElementsCurrentTimeFrame
                                        )

                                        let fileName = 'Data.json'
                                        let filePath = TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).FILE_PATH_ROOT +
                                            "/Output/" +
                                            node.outputDataset.referenceParent.parentNode.config.codeName + "/" +
                                            node.outputDataset.referenceParent.config.codeName + "/" +
                                            TIME_FRAME_LABEL
                                        filePath += '/' + fileName

                                        fileStorage.createTextFile(filePath, fileContent + '\n', onFileCreated)

                                        TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                            "[INFO] start -> writeOutputFile -> creating file at filePath = " + filePath)

                                        function onFileCreated(err) {
                                            if (err.result !== TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result) {
                                                TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                    "[ERROR] start -> writeOutputFile -> onFileCreated -> err = " + err.stack)
                                                callBackFunction(err)
                                                return
                                            }

                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[WARN] start -> writeOutputFile -> onFileCreated ->  Finished with File @ " +
                                                TS.projects.superalgos.globals.taskConstants.TASK_NODE.parentNode.parentNode.parentNode.referenceParent.baseAsset.referenceParent.config.codeName + "_" +
                                                TS.projects.superalgos.globals.taskConstants.TASK_NODE.parentNode.parentNode.parentNode.referenceParent.quotedAsset.referenceParent.config.codeName + ", " +
                                                " filePath = " + filePath + "/" + fileName)
                                            callBack()
                                        }

                                    }
                                    catch (err) {
                                        TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                                        TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                            "[ERROR] start -> writeOutputFile -> err = " + err.stack)
                                        callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE)
                                    }
                                }
                            }
                        }

                        function controlLoop() {
                            timeFrameArrayIndex++
                            if (timeFrameArrayIndex < TS.projects.superalgos.globals.timeFrames.marketFilesPeriods().length) {
                                loopBody()
                            } else {
                                TS.projects.superalgos.functionLibraries.dataAggregationFunctions.writeStatusReport(
                                    statusDependenciesModule,
                                    contextVariables,
                                    contextVariables.datetimeLastProducedFile,
                                    moveToNextDay,
                                    processIndex,
                                    callBackFunction
                                )
                            }
                        }
                    }
                }
                catch (err) {
                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                        "[ERROR] start -> buildOutput -> err = " + err.stack)
                    callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE)
                }
            }
        }
        catch (err) {
            TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                "[ERROR] start -> err = " + err.stack)
            callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE)
        }
    }
}
