import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prismadb from "@/lib/prismadb";
import { cookies } from 'next/headers'
import { verifyAuth } from '@/lib/auth';
import bcrypt from "bcrypt";

export async function GET(req: NextRequest) { 
  try {
    let userAuth : string = "";
    let loketAuth : string = "";
    let passAuth : string = "";

    const authHeader = req.headers.get('Authorization');
    const tokenHeader = authHeader?.replace("Bearer ","") || "";

    const [nopel, periode] = req.url.split('/').slice(-2);

    const isVerif  = await verifyAuth(tokenHeader);
    if (isVerif.status) {
      userAuth = isVerif.data?.user || "";
      loketAuth = isVerif.data?.kodeloket || "";  
      passAuth =  isVerif.data?.pass || "";     
    } else {
      return NextResponse.json(
        { success: false,
          rescode : 401,
          message: 'Screet Key failed' },
        { status: 401 }
      )     
    }

    const isUser =  await prismadb.users.findUnique({
      where : {
        username : userAuth,
        is_user_ppob : true,
        is_active : true
      }
    });
    
    if (!isUser) {
      return NextResponse.json(
        {
          rescode : 210,
          success : false,
          message : "User Tidak Terdaftar",
          data : {
            namauser : userAuth,
            passworduser : passAuth,
            kodeloket : loketAuth
          }
        }

        ,{status : 200})  
    }

    
    const isLoket = await prismadb.loket.findUnique({
      where : {
        kodeloket : loketAuth
      }
    })
    if (!isLoket) {
      return NextResponse.json(
        {
          rescode : 210,
          success : false,
          message : "Kode Loket Tidak Terdaftar",
          data : {
            namauser : userAuth,
            passworduser : passAuth,
            kodeloket : loketAuth
          }
        }

        ,{status : 200})  
    }
    
    
    const isUserLoket = await prismadb.user_loket.findUnique({ 
      where : {
        user_id_2 : {
          user_id : isUser.id,
          loket_id : isLoket.id
        },
      }
    })
    if (!isUserLoket) {
      return NextResponse.json(
        {
          rescode : 210,
          success : false,
          message : "Kode Loket Tidak Terdaftar",
          data : {
            namauser : userAuth,
            passworduser : passAuth,
            kodeloket : loketAuth
          }
        }

        ,{status : 200})  
    } 


    const isPassCompare = await bcrypt.compare(passAuth, isUser.password);

    if (!isPassCompare) {
      return NextResponse.json(
        {
          rescode : 210,
          success : false,
          message : "Password Tidak Valid",
          data : {
            namauser : userAuth,
            passworduser : passAuth,
            kodeloket : loketAuth
          }
        }

        ,{status : 200})  
    }  
    
    
    const isPelcoklit = await prismadb.pel_coklit.findUnique({
      where : {
        no_pelanggan :  nopel || ""
      }
    })
    if (!isPelcoklit) {
      return NextResponse.json(
        {
          rescode : 211,
          success : false,
          message : "No Pelanggan Coklit Tidak Terdaftar",
          data : {
            nopel : nopel || ""
          }
        }

        ,{status : 200})  
    }

    const isPel = await prismadb.pelanggan.findUnique({
      where : {
        no_pelanggan :  nopel || "",
      }
    })
    if (!isPel) {
      return NextResponse.json(
        {
          rescode : 211,
          success : false,
          message : "No Pelanggan Tidak Terdaftar",
          data : {
            nopel : nopel || "" 
          }
        }

        ,{status : 200})  
    }
    
    const datatagihan : any[] = await prismadb.$queryRaw(
      Prisma.sql`call infobayar_coklit(${nopel},${isUser.id},${periode})` 
    )
    
    if (!datatagihan || datatagihan.length === 0) {
      return NextResponse.json(
        {
          rescode : 401,
          success : false,
          message : "Tidak Ada Data atau Belum Lunas",
          data : {
            nopel : nopel || "" 
          }
        }

        ,{status : 200})  
    }
    console.log(datatagihan);
    datatagihan.reverse()
    
    const resultDataTag = datatagihan.map(val => {
  
      const res = {
        periode : val.f2 ,
        golongan : val.f5 ,
        stanlalu : parseInt(val.f8),
        stanini : parseInt(val.f9),
        pakaim3 : parseInt(val.f10),
        hargaair : parseInt(val.f11),
        adminpdam : parseInt(val.f13),
        danameter : parseInt(val.f14),
        retribusi : parseInt(val.f15),
        denda : parseInt(val.f19),
        total : parseInt(val.f22),
        user : isUser.nama
      }

      return res;
    })

    const result = 
    {
      rescode : 400,
      success : true,
      message : "Info Pembayaran Tersedia",
      data : {
        no_pelanggan : isPel.no_pelanggan.trim(),
        nama : isPel.nama?.trim(),
        alamat : isPel.alamat?.trim(),
        tagihan : resultDataTag
      }
    }



    return NextResponse.json(result,{status : 200})   

  } catch (error) {
    return NextResponse.json({
      rescode : 500,
      success : false,
      message : `General Error : ${error}`
    }, { status: 500 })
  }


}
