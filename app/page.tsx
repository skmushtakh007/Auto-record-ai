"use client"
import { ModeToggle } from '@/components/theme-toggle';
import { Separator } from '@/components/ui/separator';
import { useEffect, useRef, useState } from 'react'
import Webcam from 'react-webcam'
import { Button } from '@/components/ui/button';
import { FlipHorizontal, PersonStanding, Volume2 } from 'lucide-react';
import { Camera, Video } from 'lucide-react';
import { MoonIcon, SunIcon } from "lucide-react"
import { toast } from "sonner"
import { Rings } from 'react-loader-spinner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { beep } from '@/utils/audio';
import * as cocossd from '@tensorflow-models/coco-ssd'
import "@tensorflow/tfjs-backend-cpu"
import '@tensorflow/tfjs-backend-webgl'
import { ObjectDetection } from '@tensorflow-models/coco-ssd';
import { drawOnCanvas } from '@/utils/draw';
import SocialMediaLinks from '@/components/social-links';
let interval: any = null;
let stopTimeout: any = null;
type Props = {}

const HomePage = (props: Props) => {
  //state
  const [mirrored, setMirrored] = useState<boolean>(false);
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRocording, setIsRecording] = useState<boolean>(true);
  const [autoRecordEnabled, setautoRecordEnabled] = useState<boolean>(false);
  const [volume, setValume] = useState(0.8);
  const [model, setModel] = useState<ObjectDetection>();
  const [loading, setLoading] = useState(false)


  // for media recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // initialize the media recorder
  useEffect(() => {
    // if webscam in state
    if (webcamRef && webcamRef.current) {
      const stream = (webcamRef.current.video as any).captureStream();
      if (stream) {
        mediaRecorderRef.current = new MediaRecorder(stream);

        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) {
            const recordedBlob = new Blob([e.data], { type: 'video' });
            const videoURL = URL.createObjectURL(recordedBlob);

            const a = document.createElement('a');
            a.href = videoURL;
            a.download = `${formatDate(new Date())}.webm`;
            a.click();
          }
        };
        mediaRecorderRef.current.onstart = (e) => {
          setIsRecording(true);
        }
        mediaRecorderRef.current.onstop = (e) => {
          setIsRecording(false);
        }
      }
    }
  }, [webcamRef])

  // load as soon as page load    1
  useEffect(() => {
    setLoading(true);
    initModel();
  }, [])

  // loads model 
  // set it in a state varaible
  async function initModel() {       //2
    const loadedModel: ObjectDetection = await cocossd.load({
      base: 'mobilenet_v2'
    });
    setModel(loadedModel);
  }

  useEffect(() => {    //3
    if (model) {
      setLoading(false)
    }
  }, [model])

  // created to check certain component finished loading or not
  useEffect(() => {   //4
    interval = setInterval(() => {
      runPrediction();
    }, 1000)

    return () => clearInterval(interval); // clearing statement
  }, [webcamRef.current, model, mirrored, autoRecordEnabled]) // multiple statement running


  //  checking/verifying person in every second      4=we have enough data
  async function runPrediction() {  //5
    if (
      model
      && webcamRef.current
      && webcamRef.current.video
      && webcamRef.current.video.readyState === 4
    ) {
      const predictions = await model.detect(webcamRef.current.video);
      // console.log(predictions)


      // it will create box around person
      resizeCanvas(canvasRef, webcamRef);
      drawOnCanvas(mirrored, predictions, canvasRef.current?.getContext('2d'))


      // writing logic for automatic recording
      let isPerson: boolean = false;
      if (predictions.length > 0) {
        predictions.forEach((prediction) => {
          isPerson = prediction.class === 'person'
        })
        if (isPerson && autoRecordEnabled) {
          startRecording(true);
        }
      }

    }
  }


  return (
    <div className='flex h-screen'>
      {/* left division  - webcam and cnavas */}
      <div className="relative">
        <div className='relative h-screen w-full'>
          <Webcam ref={webcamRef}
            mirrored={mirrored}
            className='h-full w-full object-contain p-2'
          />
          {/* inside canva component we show detected objec (red or green) */}
          <canvas ref={canvasRef}
            className='absolute top-0 left-0 h-full w-full object-contain'>
          </canvas>
        </div>
      </div>
      {/* Right division -container for button panel and wiki section */}
      <div className='flex flex-row flex-1'>
        <div className='border-primary/5 border-2 max-w-xs flex flex-col gap-2 justify-between shadow-md'>
          {/* top section */}
          <div className='flex flex-col gap-2'>
            <ModeToggle />
            <Button variant={'outline'} size={'icon'}
              onClick={() => {
                setMirrored((prev) => !prev)
              }}
            >
              <FlipHorizontal />
            </Button>
            <Separator className='my-2' />
          </div>
          {/* mid section */}
          <div className='flex flex-col gap-2'>
            <Button variant={'outline'} size={'icon'}
              onClick={userPromptScreenshot}
            >
              <Camera />
            </Button>
            <Separator className='my-2' />
          </div>
          {/* bottom section */}
          <div className='flex flex-col gap-2'>
            <Button variant={isRocording ? 'destructive' : 'outline'} size={'icon'}
              onClick={userPromptRecord}
            >
              <Video />
            </Button>
            <Separator className='my-2' />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={'outline'} size={'icon'}>
                  <Volume2 />
                </Button>
              </PopoverTrigger >
              <PopoverContent>
                <Slider
                  max={1}
                  min={0}
                  step={0.2}
                  defaultValue={[volume]} onValueCommit={(val) => {
                    setValume(val[0]);
                    beep(val[0]);
                  }}>
                </Slider>
              </PopoverContent>
            </Popover>

            <Button variant={autoRecordEnabled ? 'destructive' : 'outline'}
              size={'icon'}
              onClick={toggleAutoRecord}>
              {
                autoRecordEnabled ? <Rings color='white' height={45} /> : <PersonStanding />
              }
            </Button>
          </div>
        </div>

        <div className='h-full flex-1 px-2 overflow-y-scroll'>
          <RenderFeatureHighlightsSection />
        </div>
      </div>
      {loading && <div className='z-50 absolute w-full h-full flex items-center justify-center bg-primary-foreground'>
        Getting things ready . . . <Rings height={50} color='red' />
      </div>}
    </div>
  )
  function userPromptScreenshot() {
    //take a picture
    if (!webcamRef.current) {
      toast('camera not found. Please refresh');
    }
    else {
      const imgSrc = webcamRef.current.getScreenshot();
      console.log(imgSrc);
      const blob = base64toBlob(imgSrc);

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a');
      a.href = url;
      a.download = `${formatDate(new Date())}.png`
      a.click();
    }

  }
  function userPromptRecord() {

    if (!webcamRef.current) {
      toast('Camera is not found. Please refresh.')
    }

    if (mediaRecorderRef.current?.state == 'recording') {
      // check if recording
      // then stop recording 
      // and save to downloads
      mediaRecorderRef.current.requestData();
      clearTimeout(stopTimeout);      //stop when user click
      mediaRecorderRef.current.stop();
      toast("Recording saved to downloads");

    } else {
      // if not recording
      // start recording 
      startRecording(false);
    }
  }

  function startRecording(doBeep: boolean) {
    if (webcamRef.current && mediaRecorderRef.current?.state !== 'recording') {
      mediaRecorderRef.current?.start();
      doBeep && beep(volume); // gives sound when recording start

      stopTimeout = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.requestData();
          mediaRecorderRef.current.stop();
        }
      }, 30000);
    }
  }

  function toggleAutoRecord() {
    if (autoRecordEnabled) {
      setautoRecordEnabled(false)
      //show toast to user notify the change
      toast("autorecord disabled.")
    }
    else {
      setautoRecordEnabled(true)
      //show toast to user notify the change
      toast("Autorecord enabled.")
    }
  }

  function RenderFeatureHighlightsSection() {
    return <div className="text-xs text-muted-foreground">
      <ul className="space-y-4">
        <li>
          <strong>Dark Mode/Sys Theme 🌗</strong>
          <p>Toggle between dark mode and system theme.</p>
          <Button className="my-2 h-6 w-6" variant={"outline"} size={"icon"}>
            <SunIcon size={14} />
          </Button>{" "}
          /{" "}
          <Button className="my-2 h-6 w-6" variant={"outline"} size={"icon"}>
            <MoonIcon size={14} />
          </Button>
        </li>
        <li>
          <strong>Horizontal Flip ↔️</strong>
          <p>Adjust horizontal orientation.</p>
          <Button className='h-6 w-6 my-2'
            variant={'outline'} size={'icon'}
            onClick={() => {
              setMirrored((prev) => !prev)
            }}
          ><FlipHorizontal size={14} /></Button>
        </li>
        <Separator />
        <li>
          <strong>Take Pictures 📸</strong>
          <p>Capture snapshots at any moment from the video feed.</p>
          <Button
            className='h-6 w-6 my-2'
            variant={'outline'} size={'icon'}
            onClick={userPromptScreenshot}
          >
            <Camera size={14} />
          </Button>
        </li>
        <li>
          <strong>Manual Video Recording 📽️</strong>
          <p>Manually record video clips as needed.</p>
          <Button className='h-6 w-6 my-2'
            variant={isRocording ? 'destructive' : 'outline'} size={'icon'}
            onClick={userPromptRecord}
          >
            <Video size={14} />
          </Button>
        </li>
        <Button variant={isRocording ? 'destructive' : 'outline'} size={'icon'}
          onClick={userPromptRecord}
        >
          <Video size={14} />
        </Button>
        <Separator />
        <li>
          <strong>Enable/Disable Auto Record 🚫</strong>
          <p>
            Option to enable/disable automatic video recording whenever
            required.
          </p>
          <Button className='h-6 w-6 my-2'
            variant={autoRecordEnabled ? 'destructive' : 'outline'}
            size={'icon'}
            onClick={toggleAutoRecord}
          >
            {autoRecordEnabled ? <Rings color='white' height={30} /> : <PersonStanding size={14} />}

          </Button>
        </li>

        <li>
          <strong>Volume Slider 🔊</strong>
          <p>Adjust the volume level of the notifications.</p>
          <Button
            className='h-6 w-6 my-2'
            variant={'outline'} size={'icon'}
            onClick={() => {
              setMirrored((prev) => !prev)
            }}
          >
            <FlipHorizontal size={14} />
          </Button>
        </li>
        <li>
          <strong>Camera Feed Highlighting 🎨</strong>
          <p>
            Highlights persons in{" "}
            <span style={{ color: "#FF0F0F" }}>red</span> and other objects in{" "}
            <span style={{ color: "#00B612" }}>green</span>.
          </p>
        </li>
        <Separator />
        <li className="space-y-4">
          <strong>Share your thoughts 💬 </strong>
          {/* <SocialMediaLinks/> */}
          <SocialMediaLinks />
          <br />
          <br />
          <br />
        </li>
      </ul>
    </div>
  }
}


export default HomePage;

function resizeCanvas(canvasRef: React.RefObject<HTMLCanvasElement>, webcamRef: React.RefObject<Webcam>) {
  const canvas = canvasRef.current;
  const video = webcamRef.current?.video;

  if ((canvas && video)) {
    const { videoWidth, videoHeight } = video;
    canvas.width = videoWidth;
    canvas.height = videoHeight;
  }
}

function formatDate(d: Date) {
  const formattedDate =
    [
      (d.getMonth() + 1).toString().padStart(2, "0"),
      d.getDate().toString().padStart(2, "e"),
      d.getSeconds().toString().padStart(2, "e"),
      d.getFullYear(),

    ]
      .join("-") +
    " " +
    [
      d.getHours().toString().padStart(2, "0"),
      d.getMinutes().toString().padStart(2, "0"),
      d.getSeconds().toString().padStart(2, "0")
    ].join("_");
  return formattedDate
}


// convert this function raw data into image
function base64toBlob(base64Data: any) {
  const byteCharacters = atob(base64Data.split(",")[1]);
  const arrayBuffer = new ArrayBuffer(byteCharacters.length);
  const byteArray = new Uint8Array(arrayBuffer);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }

  return new Blob([arrayBuffer], { type: "image/png" }); // Specify the image type here
}

