import * as d3 from "d3";

export const useViewStore = defineStore('view', ()=>{
    const { colourMap, colourMapFiltered, scales } = useReferenceStore();
    const { handleNumeric,
            handleObjectPath,
            handleValue,
            handleArray,
            handleColourValue,
            isNumber,
            isString,
            isArray,
            containsNumber,
            processDomain } = useUtils();

    // LIBRARY STATE OBJECT//
    const libraryData = ref({})

    const formattedLibrary = ref([])
    
    //Set-up objects which can be checked for display using 'include' 
    const colourCategory = {
        // 'Size': schemePaired,
        // 'Place of publication': schemePaired,
        // 'Print or manuscript': ,
        // 'STC or Wing'schemeDark2

        // schemePaired: ['Size', 'Place of publication'],
        // schemeDark2: ['Print or manuscript','STC or Wing'],
        // schemeDark2: ['Print or manuscript','STC or Wing'],

    }

    const heightCategory = {
        logarithmic: ['Number of marks', 'Number of book images', 'Size'],
        year: ['Date of publication', 'Female agent date']

    }

    // LIBRARY VIEW OBJECT//
    const libraryDisplay = reactive({
        //sub items in view and viewType are called the 'viewMode'.
        view: {
            itemType: "Book",
            id: 'BookID',
            shelf: 'Repository', //Primary sort
            useShelf: true,
            showShelf: true,
            bookend: 'Date of publication', //Secondary sort
            useBookend: true,
            showBookend: true,
            height: 'Date of publication',
            useHeight: true,
            colour: 'Genre/Identity',
            useColour: true,
            label: 'Title',
            useLabel: true,
            agentLabel: 'Female agent name',
            bookLabel: 'Title',
            markLabel: 'Transcription',
            agentCollectionProp1: 'Mark type (Mark of?)',
            agentCollectionProp2: 'Genre/Identity',
            bookCollectionProp1: 'Female agent name',
            bookCollectionProp2: 'Number of marks',
            markCollectionProp1: 'Female agent name',
            markCollectionProp2: 'Title',
        },
        viewType: {
            id: 'Book',
            shelf: 'Book',
            bookend: 'Book',
            height: 'Book',
            colour: 'Book',
            label: 'Book',
            agentLabel: 'Agent',
            bookLabel: 'Book',
            markLabel: 'Mark',
            agentCollectionProp1: 'Mark',
            agentCollectionProp2: 'Book',
            bookCollectionProp1: 'Agent',
            bookCollectionProp2: 'Book',
            markCollectionProp1: 'Agent',
            markCollectionProp2: 'Book',
        },
        AgentLookUp: {
            Agent: '',
            Book: 'Marks.Books',
            Mark: 'Marks'
        },
        BookLookUp: {
            Agent: `Marks,0,Agents`,
            Book: '',
            Mark: 'Marks'
        },
        MarkLookUp: {
            Agent: 'Agents',
            Book: 'Books',
            Mark: ''
        },
    
    })

    // INTERNAL GETTERS //
    //Get item height bounds
    const getDomainIndex = computed (() => {
        return {min: d3.minIndex(libraryData.value, d => getIDP(d, 'height')), 
                max: d3.maxIndex(libraryData.value, d => getIDP(d, 'height'))}
    })

    //Get unique values in colour set
    const getColourSet = computed (() => {
    return processColourSet(libraryData.value)
    })
    
    // EXTERNAL GETTERS //
    //Library Structure
    watch([libraryData.value, libraryDisplay],() => {
        formattedLibrary.value =  formatLibrary(libraryData.value, libraryDisplay);
    })
    //Item Height - Returns d3 Scale Function
    const itemHeight =  computed (() => {
        return formatHeight(libraryData.value, libraryDisplay);
    })
    //Item Colour - Returns d3 Scale Function
    const itemColour =  computed (() => {
        return formatColour(libraryData.value, libraryDisplay);
    })

    // CREATE VIEW EDITOR //
    const viewHeightBounds = computed (() => {
        return [libraryData.value[getDomainIndex.value.min],
                libraryData.value[getDomainIndex.value.max]]
    })
    //Currently applies to Arrays only
    const viewColourSet = computed (() => {
        return processColourItems(libraryData.value, getColourSet.value)
    })


    // INTERNAL FUNCTIONS //
    // FORMAT LIBRARY //
    //Set Shelves
    function formatShelf(data, viewMode){
        return d3.flatGroup(d3.sort(data, d=> getIDP(d, viewMode)), d => getIDP(d, viewMode)); 
    }
    //Set Bookends
    function formatBookend(data, viewMode){
        return data
        .map(d => [d[0],d3.flatGroup(d3.sort(d[1], d=> getIDP(d, viewMode)), d=> getIDP(d, viewMode))]);  
    }
    //Combine Shelves & Bookend
    function formatLibrary(data, display) {
        //Shelves - Sort & Group Items by Shelf Category
        const shelfFormatData = display.view.useShelf 
        ? formatShelf(data, 'shelf') 
        : formatShelf(data, 'id'); //Default
        //Bookends - Further Sort & Group Items by Bookend Category
        const shelfBookendFormatData = display.view.useBookend 
        ? formatBookend(shelfFormatData, 'bookend') 
        : formatBookend(shelfFormatData, 'id'); //Default
        return shelfBookendFormatData
    }

    // HANDLE HEIGHT //
    function formatHeight(data, view) {
        const viewSelection = libraryDisplay.view.height
        console.log('heightCategory', heightCategory.logarithmic.includes(viewSelection))
        //Returns a function which takes the log scale of the input then invokes the d3 scale function (IIFE)
        if(heightCategory.logarithmic.includes(viewSelection)){
            return (value)=>{ 
                return (d3.scaleLinear()
                            .domain(chooseHeightDomain(data).map(d => Math.log(d))) 
                            .unknown(scales.maxItemHeight) //Set all non-numeric values to max height
                            .range([scales.minItemHeight, scales.maxItemHeight])
                            .clamp(true)
                        )(Math.log(value)); 
            }
        }else{
            return d3.scaleLinear()
                        .domain(chooseHeightDomain(data)) 
                        .unknown(scales.maxItemHeight) //Set all non-numeric values to max height
                        .range([scales.minItemHeight, scales.maxItemHeight])
                        .clamp(true);     
        }
    }
    
    function chooseHeightDomain(data){   
            const viewSelection = libraryDisplay.view.height
            const domainIndex = getDomainIndex.value
            if(heightCategory.year.includes(viewSelection)) {
                return [1450, 1750] //was - clamp(1450, longestNumber, 1750)
            }else{
                return [getIDP(data[domainIndex.min], 'height'), getIDP(data[domainIndex.max], 'height')]
            }
    }

    // HANDLE COLOUR //
    function formatColour(data, view){
        const viewMode = 'colour'
        const viewSelection = libraryDisplay.view[viewMode]
        const viewModeType = libraryDisplay.viewType[viewMode]

        console.log(viewModeType, viewSelection, viewMode)

        const colourFunction = colourMap.get(viewModeType)[viewSelection].func
        const colourScheme = colourMap.get(viewModeType)[viewSelection].scheme
        const useLen = colourMap.get(viewModeType)[viewSelection].useLen
        // if(data.some(d => isNumber(getIDP(d, 'colour')))){
        //     console.log('Colour Continuous')
        //     return d3.scaleLinear()
        //                 .domain(d3
        //                     .extent(data
        //                     .filter(d => getIDP(d, 'colour'))
        //                     .map(d => {
        //                         return getIDP(d, 'colour')})))
        //                 .range(['royalblue', 'pink'])
        //                 .clamp(true)
        // }
        const colourScale = colourBandscale(processColourSet(data))
        console.log('Colour Ordinal')
        if(true){
             const colourFunc = d3[colourFunction](d3[colourScheme]) //Domain defaults to [0,1]
            return (
                (value) => colourFunc(colourScale(value)) //Returns nested scale function after applying band function
            )
        }
        else{
            return (value) => {
                return (d3[colourFunction](d3[colourScheme])
                    .domain([0, Math.log(1000)]))(Math.log(value))
            }
        }

        


                    //len = viewColourSet.length
    }

    function colourBandscale(colourSet){
        console.log('Array.from colourSet',Array.from(colourSet))
        return d3.scaleBand()
                    .domain(Array.from(colourSet)) //Range defaults to [0,1]
    }

    function processColourSet(data){
        // console.log('flatMap', data.flatMap(d=> getIDP(d, 'colour')))
        // console.log('sort',data.flatMap(d=> getIDP(d, 'colour')).sort(alphabetically(true)))
        // console.log('sorted set',  new Set(data.flatMap(d=> getIDP(d, 'colour')).sort(alphabetically(true))))
       return new Set(data.flatMap(d=> getIDP(d, 'colour')).sort(alphabetically(true)))
    }

    function processColourItems(data, colourSet){
        let tempColourSet = colourSet;
        const uniqueColours = data.filter((d) => {
            const value = getIDP(d, 'colour')
            if(tempColourSet.has(value)){
                return tempColourSet.delete(value) //Returns true if deletion successful
            }else{
                return false
            }
        })
        // console.log('unique colours', new Set(uniqueColours.sort((a, b) => alphabetically(true)(getIDP(a, 'colour'), getIDP(b, 'colour')))))


        return  new Set(uniqueColours.sort((a, b) => alphabetically(true)(getIDP(a, 'colour'), getIDP(b, 'colour'))))
    }

    // EXTERNAL FUNCTIONS //
    //Parse Data Object from Supabase
    async function parseDatabase(tableData) {
            libraryData.value = await JSON.parse(JSON.stringify(tableData))
            formattedLibrary.value =  formatLibrary(libraryData.value, libraryDisplay);
    }
    //Update View Object from user input
    function handleViewSelection(viewMode, viewSelection, itemType){
        console.log('handleViewSelection', viewMode, viewSelection, itemType)
        libraryDisplay.view[viewMode] = viewSelection; //Future addition - updateView below (in database)
        libraryDisplay.viewType[viewMode] = itemType; //Future addition - updateViewType below (in database)
    }

    //Dynamic Path
    //Returns the path from the itemType (via the ID name) to the itemType of the viewMode (via viewType LookUp)
    //getIDP - getItemDisplayPath - Condensed for frequent use.
    function getIDP(item, viewMode) {
        let value;
        if(!item) return null
        const viewSelection = libraryDisplay.view[viewMode]
        const viewModeType = libraryDisplay.viewType[viewMode]
        const itemType = itemTypeCheck(item)

        // console.log('item',item)
        // console.log('hasOwnProperty: Marks', item.hasOwnProperty('Marks'))
        // console.log('Length: Marks', item['Books'].length)
        // console.log('item type', itemType, 'viewSelection', viewSelection, 'viewModeType', viewModeType)
        if(itemType === 'Agent'){
            //Agent Item paths
            if(viewModeType === 'Agent') value = handleObjectPath(item, viewMode, viewSelection)
            if(viewModeType === 'Mark') value = handleObjectPath(item, viewMode, 'Marks', 0, viewSelection)
            if(viewModeType === 'Book') value = handleObjectPath(item, viewMode, 'Marks', 0, 'Books', viewSelection)
        }else if(itemType === 'Book'){
            //Book Item paths                 
            if(viewModeType === 'Book') value = handleObjectPath(item, viewMode, viewSelection)
            if(viewModeType === 'Mark') value = handleObjectPath(item, viewMode,'Marks',0,viewSelection)
            if(viewModeType === 'Agent') value = handleObjectPath(item, viewMode, 'Marks', 0, 'Agents', viewSelection)
        }else if(itemType === 'Mark'){
            //Mark Item paths
            if(viewModeType === 'Mark') value = handleObjectPath(item, viewMode, viewSelection)
            if(viewModeType === 'Agent') value = handleObjectPath(item, viewMode, 'Agents', viewSelection) 
            if(viewModeType === 'Book') value = handleObjectPath(item, viewMode, 'Books', viewSelection)
        }
            return value ? value : "no data"
        
        //Add editor for No Value - return "No Data"
        // var [marks, markIndex, agent]  = libraryDisplay.BookLookUp[libraryDisplay.viewType[viewMode]].split(',')
        //     return item[marks][markIndex][agent]
    }

    function itemTypeCheck(item){
        return  item['FemaleAgentID'] ? 'Agent' :
                item['BookID'] ? 'Book' :
                item['MargID'] ? 'Mark' : ''
    }

    function alphabetically(ascending) {
        return function (a, b) {
          // equal items sort equally
          if (a === b) {
              return 0;
          }
      
          // nulls sort after anything else
          if (a === 'no data') {
              return 1;
          }
          if (b === 'no data') {
              return -1;
          }
      
          // otherwise, if we're ascending, lowest sorts first
          if (ascending) {
              return a < b ? -1 : 1;
          }
      
          // if descending, highest sorts first
          return a < b ? 1 : -1;
        };
      }


      return {  libraryData,
                libraryDisplay,
                formattedLibrary, 
                colourCategory,
                heightCategory,
                itemHeight,
                itemColour, 
                viewHeightBounds, 
                viewColourSet,
                parseDatabase,
                handleViewSelection,
                getIDP,
                itemTypeCheck  }
  })
