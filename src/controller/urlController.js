const urlModel = require("../models/urlModel")
const shortId = require('shortid')
const validUrl = require('valid-url')
const  baseUrl= 'http://localhost:3000'

const redis = require("redis");

const { promisify } = require("util");

//Connect to redis
const redisClient = redis.createClient(
    16088,
    "redis-16088.c264.ap-south-1-1.ec2.cloud.redislabs.com",
    { no_ready_check: true }
);
redisClient.auth("h1VgZ4AWe5EJlg2jv16mkDYgyGE1OTx9", function (err) {
    if (err) throw err;
});

redisClient.on("connect", async function () {
  console.log("Connected to Redis..");
});


//Connection setup for redis

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);




const urlCreate = async function(req,res) {
    try{
        const requestBody = req.body

        // check base url if valid using the validUrl.isUri method
        if (!validUrl.isUri(baseUrl)) {
            return res.status(400).json('Invalid base URL')
        }

        if(!Object.keys(requestBody).length > 0){
            return res.status(400).send({status:false,message:"Invalid request parameters"})
        }

        const { longUrl } = requestBody // destructure the longUrl 

        if(!longUrl){
            return res.status(400).send({status:false,message:"LongUrl required"})
        }

        // check long url if valid using the validUrl.isUri method
        if (!validUrl.isUri(longUrl)) {
            return res.status(200).send({status:false,msg:"Invalid longUrl"})
        }


        // const urlExist = await urlModel.findOne({longUrl})

        const urlExist = await GET_ASYNC(`${longUrl}`)
        const parsedUrl = JSON.parse(urlExist)
         // url exist and return the respose
        if (parsedUrl) {
            return res.status(200).send({ status: true, data: {longUrl :parsedUrl.longUrl,shortUrl: parsedUrl.shortUrl,urlCode: parsedUrl.urlCode} });
        } 

        // if baseUrl and longUrl valid, we create the url code
        const urlCode = shortId.generate()

        const code = await urlModel.findOne({urlCode})
        if(code){
            return res.status(400).send({status:false, msg:"urlCode already exist"})
        }
     
        // join the generated short code the the base url
        const shortUrl = baseUrl + '/' + urlCode

        // invoking the Url model and saving to the DB
        let url = { longUrl, shortUrl, urlCode }
        const data= await urlModel.create(url)

        await SET_ASYNC(`${data.longUrl}`, JSON.stringify(data))

        //await SET_ASYNC(`${req.params.authorId}`, JSON.stringify(profile))
        return res.status(201).send({ status: true,message:"ShortUrl is created", data:{longUrl :data.longUrl,shortUrl: data.shortUrl,urlCode: data.urlCode}});

    }
    catch(err){
        return res.status(500).send({status:false,message:err.message})
    }
}

const getUrl = async function(req,res){
    try{
        const urlCode = req.params.urlCode

        if(!shortId.isValid(urlCode)){
            return res.status(400).send({status:false,message:"Invalid urlCode"})
        }

        const getCode = await GET_ASYNC(`${urlCode}`)
        const parsedCode = JSON.parse(getCode)
        if(parsedCode){
            return res.status(302).redirect(parsedCode.longUrl)
        }
        else{
            const codeExist = await urlModel.findOne({urlCode:urlCode});
            if(!codeExist){
                return res.status(404).send({status:false,message:"urlCode does not exist"})
            }
            await SET_ASYNC(`${urlCode}`, JSON.stringify(codeExist))
            return res.status(302).redirect(codeExist.longUrl)
        }

    }
    catch(error){
        return res.status(500).send({status:false,message:error.message})
    }
}


module.exports = { urlCreate, getUrl };