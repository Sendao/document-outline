const {Point, Range} = require('atom');
const {AbstractModel} =require('./abstract-model');
const tagsRead = require('./symbols-loader');

const path = require('path');

var files_tags = {};

class TagsModel extends AbstractModel {
  constructor(editorOrBuffer) {
    super(editorOrBuffer, null);
    this.readVars = atom.config.get("document-outline.showVariables");
    this.spacesPerTab = atom.config.get("document-outline.spacesPerTab");
    this.lastLength = 0;
    this.lastResults = [];
    //console.log("symbols: created.");
  }

  getFTL() {
    return 'ctags_read_complete' in files_tags && files_tags['ctags_read_complete'];
  }

  parse() {
    // avoid reparsing.
    if( files_tags['ctags_read_complete'] != true ) {
      console.log("symbols: tried to parse before ready (" + Object.keys(files_tags).length + " entries).");
      return [];
    }
    //console.log("symbols: doing parse!");
    var rawHeadings=[], rhead;
    var text = this.buffer.getText();
    if( this.lastLength == text.length ) {
      return this.lastResults;
    }
    var linePos, lastLine=0, pText, pLastText;
    var lastSpaces, lastWasSymbol=false, lastHadOpener=false, nSpaces, n, currentLevel=0
    var lastPointStart, lastPointEnd;
    let lineNo=0;
    var levelSpaces = [];
    var words;
    var TABSPACES = this.spacesPerTab;

    // read filename
    var fn = normalPath( this.buffer.getPath() );
    // find the name in the tags list
    if( !(fn in files_tags) ) {
      console.warn("Couldn't find files_tags[" + fn + "] (ft has " + Object.keys(files_tags).length + " entries)");
      return [];
    }
    //console.info("Found files_tags[ " + fn + " ] = " + files_tags[fn].length);

    var taglist = files_tags[fn];
    var tags_words = Object.keys(taglist);
    console.log("Working with " + tags_words.length + " possible tags");
    console.log(tags_words);
    /*
    var tagexps = {};
    for( var symName in taglist ) {
      for( var lineExp in taglist[symName] ) {
        if( !(lineExp in tagexps) )
          tagexps[lineExp] = [];
        tagexps[lineExp].push( symName );
      }
    }
    */


    while( true ) {
      //console.log("linePos=" + linePos);
      for( linePos=lastLine+1; linePos < text.length && text[linePos] != '\n'; linePos++ );
      if( linePos >= text.length )
        break;
    //while( (linePos=text.indexOf("\n", lastLine+1)) != -1 ) { -- this hangs on large files?
      pText = text.substr( lastLine+1, linePos-1-lastLine );

      if( pText[0] == '/' && pText[1] == '/' ) { // support the '/. at the beginning of the line indicates a comment' syntax
        lastLine = linePos;
        pLastText = "";
        continue;
      }

      nSpaces=0;
      for( n=0; n<pText.length; ++n ) {
        if( pText[n] == ' ' ) nSpaces++;
        else if( pText[n] == '\t' ) nSpaces += TABSPACES;
        else if( pText[n] == '\r' ) continue;
        else break;
      }
      //console.log("pText spaces = " + nSpaces);


      if( pText.charCodeAt( pText.length-1 ) == 13 ) {
        pText = pText.slice( 0, pText.length - 1 );
      }

      var pTrim = pText.trim();
        // did we lose a level?
      if( pTrim != "" ) {
        while( currentLevel > 0 && nSpaces < levelSpaces[ currentLevel-1 ] ) {
          levelSpaces.pop();
          currentLevel--;
          //console.log("Level < " + currentLevel);
        }
      }

      if( lastWasSymbol ) {
        // look for which symbol it actually was
        lastWasSymbol = false;
        //console.log("Looking at: '" + pLastText + "' (" + pLastText.length + ")");
        for( var nWord = 0; nWord < words.length; nWord++ ) {
          if( words[nWord] in taglist ) {
            //console.log("Maybe " + words[nWord] + ": " + Object.keys(taglist[words[nWord]]).join(","));
            if( pLastText in taglist[words[nWord]] ) {
              //console.log("Found: " + words[nWord] + ": " + taglist[words[nWord]][pLastText]);
              lastWasSymbol = words[nWord];
              break;
            }
          }
        }

        var found = false;
        if( lastWasSymbol ) {
          // We may have increased a contextual level.
          if( ( currentLevel == 0 && nSpaces > 0 )  || nSpaces > levelSpaces[currentLevel-1] ) {
            levelSpaces.push(nSpaces);
            currentLevel++;
            //console.log("Level > " + currentLevel);
          }

          // make a heading
          var pStart = new Point(lineNo - 1, lastPointStart);
          var pEnd = new Point(lineNo - 1, lastPointEnd);

          rhead = {
            level: currentLevel+1,
            headingRange: new Range( pStart, pEnd ),
            plainText: lastWasSymbol,
            children: [],
            range: new Range( pStart, Point.INFINITY),
            startPosition: pStart,
            endPosition: Point.INFINITY
          };
          //console.log("Pushed " + lastWasSymbol);
          rawHeadings.push(rhead);
        }
      }

      // prepare for the next loop:

      // see if we have a symbol on _this_ line
      words = wordsOfAString(pTrim);
      //console.log( words.join(",") );
      lastWasSymbol = false;
      for( n=0; n<words.length; ++n ) {
        if( tags_words.indexOf( words[n] ) != -1 ) {
        //if( words[n] in taglist ) {
          lastWasSymbol = words[n];
          lastPointStart = pText.indexOf( lastWasSymbol );
          lastPointEnd = lastPointStart + lastWasSymbol.length;
          //console.log("Possible symbol: " + words[n]);
          break;
        }
      }

      // go to the next line.
      if( pTrim.length > 0 )
        lastHadOpener = pTrim[ pTrim.length-1 ] == '{';
      else
        lastHadOpener = false;
      lastLine = linePos;
      pLastText = pText;
      ++lineNo;
    }
    console.log("Parsed " + rawHeadings.length + " headings.");

    this.lastLength = text.length;
    this.lastResults = rawHeadings;
    return this._stackHeadings(rawHeadings);
  }

}

function wordsOfAString( str )
{
  var i, word="", words = [];

  for( i=0; i<str.length; ++i ) {
    if( isAlpha( str[i] ) || !isNaN( parseInt(str[i]) ) ) {
      word += str[i];
    } else {
      if( word != "" )
        words.push(word);
      word = "";
    }
  }
  if( word != "" ) words.push(word);

  return words;
}

function findProjectRoot()
{
  var paths = atom.project.getPaths();
  var shortest = false;

  for( var i of paths ) {
    if( !shortest || i.length < shortest.length )
      shortest = i;
  }
  return normalPath(shortest);
}

function normalPath( fn )
{
  var parts, wasAbs=false;
  fn = path.normalize(fn);
  if( fn.indexOf('/') != -1 ) {
    parts = fn.split( path.posix.sep );
    wasAbs = path.posix.isAbsolute(fn);
  } else {
    parts = fn.split( path.win32.sep );
    wasAbs = path.win32.isAbsolute(fn);
  }
  var stx = "";
  if( !wasAbs ) {
    if( project_root === false ) project_root = findProjectRoot();
    var stx = project_root + path.posix.sep;
  }
  return stx + parts.join( path.posix.sep );
}

function isAlpha(value) {
  var upperBoundUpper = "A".charCodeAt(0);
  var lowerBoundUpper = "Z".charCodeAt(0);
  var upperBoundLower = "a".charCodeAt(0);
  var lowerBoundLower = "z".charCodeAt(0);
  var allowed_chars = "_".charCodeAt(0);

  for (var i = 0; i < value.length; i++) {
    var char = value.charCodeAt(i);
    if ((char >= upperBoundUpper && char <= lowerBoundUpper) ||
      (char >= upperBoundLower && char <= lowerBoundLower))
      continue;
    if( allowed_chars == char ) continue;
    return false;
  }
  return true;
};

function readCtags() {
  tagsRead( files_tags );
  /* -- doesn't work -- ctags doesn't work
  stream = ctags.createReadStream('./tags');
  stream.on('data', (newtags) => {
    for( var tg in newtags ) {
      var fn = normalPath(tg.file);
      if( !(fn in files_tags) ) files_tags[fn] = {};
      files_tags[ fn ].push( tg.name );
    }
  });
  */
}

readCtags();

module.exports = {  TagsModel }
