var express = require ('express');
var app = express();
var moment = require ('moment');
var voka = require ('voka');
var date = moment();


app.get("/fecha",function (req,res){
    let fechaIntroducida = req.query.fechaIntroducida;

    if(!moment(fechaIntroducida).isValid()){
    res.send("Invalida");}
    else{
       let fecha = moment(fechaIntroducida).fromNow();
        let fechaActual = moment();
        let distancia = moment().get('milliseconds', fechaActual) - moment().get('milliseconds', fechaIntroducida);
 

         
    }
})

app.get("/", function(req, res){
    
    res.send("Hola, bienvenido al Heading To Codefest")
})

//Otro endpoint 

app.get("/saludo",function(req, res){
    let nombre = req.query.nombre;
    if(nombre){
        res.send(`Hola ${nombre}, bienvenido al Heading to Codefest`);
    }else(
        res.send("Hola  bienvenido al Heading toss Codefest")
    );

});
app.listen(3000,function (){
    console.log("Taller Nodejs app listening on port 3000");
});